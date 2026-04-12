package mwsclient

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/domain"

	"github.com/go-resty/resty/v2"
)

// normalizeFusionBaseURL убирает хвост /fusion/v1, если он указан в MWS_TABLES_BASE_URL.
// Сгенерированный клиент сам добавляет пути вида /fusion/v1/...; иначе получается
// .../fusion/v1/fusion/v1/... и MWS отвечает 404 «API не существует».
func normalizeFusionBaseURL(raw string) string {
	u := strings.TrimSpace(strings.TrimRight(raw, "/"))
	for {
		lower := strings.ToLower(u)
		if !strings.HasSuffix(lower, "/fusion/v1") {
			break
		}
		u = u[:len(u)-len("/fusion/v1")]
		u = strings.TrimRight(u, "/")
	}
	return u
}

// authorizationHeaderValue формирует значение заголовка Authorization для MWS Fusion:
// ожидается «Bearer {token}». В .env иногда кладут только токен, иногда уже с префиксом Bearer.
func ptrStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func authorizationHeaderValue(apiKey string) string {
	t := strings.TrimSpace(apiKey)
	if t == "" {
		return ""
	}
	const p = "bearer "
	if len(t) >= len(p) && strings.EqualFold(t[:len(p)], p) {
		return t
	}
	return "Bearer " + t
}

type ClientWrapper struct {
	genClient  *ClientWithResponses
	httpClient *resty.Client
	baseURL    string
	apiKey     string
}

func NewClientWrapper(baseURL, apiKey string, requestTimeout time.Duration) (*ClientWrapper, error) {
	server := normalizeFusionBaseURL(baseURL)
	httpClient := resty.New().
		SetBaseURL(server).
		SetTimeout(requestTimeout).
		SetHeader("Content-Type", "application/json").
		OnAfterResponse(func(_ *resty.Client, r *resty.Response) error {
			if r.IsError() {
				return fmt.Errorf("http error: status=%s, body=%s", r.Status(), string(r.Body()))
			}

			return nil
		})

	authHeader := authorizationHeaderValue(apiKey)
	// Сгенерированный клиент вызывает http.Client.Do() со своими Request — resty SetAuthToken на такие
	// запросы не действует. Fusion требует Authorization на каждом вызове (см. спецификацию).
	genClient, err := NewClientWithResponses(
		server,
		WithHTTPClient(httpClient.GetClient()),
		WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			if authHeader != "" {
				req.Header.Set("Authorization", authHeader)
			}
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create generated client: %w", err)
	}

	return &ClientWrapper{
		httpClient: httpClient,
		baseURL:    server,
		apiKey:     apiKey,
		genClient:  genClient,
	}, nil
}

// GetTableInfo получает информацию о таблице по её ID
func (c *ClientWrapper) GetTableInfo(ctx context.Context, dstID string) (*domain.TableInfo, error) {
	params := &GetNodeDetailsParams{
		Authorization: authorizationHeaderValue(c.apiKey),
	}

	resp, err := c.genClient.GetNodeDetailsWithResponse(ctx, dstID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get node details: %w", err)
	}

	if resp.StatusCode() == http.StatusNotFound {
		// dstId даташита часто не совпадает с nodeId в /fusion/v1/nodes/{id}; имя не критично для UI.
		return &domain.TableInfo{
			ID:        dstID,
			Name:      dstID,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}, nil
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON200 == nil || resp.JSON200.Data == nil {
		return nil, fmt.Errorf("empty response data")
	}

	node := resp.JSON200.Data

	if node.Id == nil || node.Name == nil {
		return nil, fmt.Errorf("node id or name is nil")
	}

	return &domain.TableInfo{
		ID:        *node.Id,
		Name:      *node.Name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

// GetTableFields получает поля таблицы
func (c *ClientWrapper) GetTableFields(ctx context.Context, dstID, viewID string) ([]domain.TableField, error) {
	params := &GetFusionV1DatasheetsDstIdFieldsParams{}

	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.GetFusionV1DatasheetsDstIdFieldsWithResponse(ctx, dstID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get fields: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON200 == nil || resp.JSON200.Data == nil {
		return nil, fmt.Errorf("empty response data")
	}

	if resp.JSON200.Data.Fields == nil {
		return []domain.TableField{}, nil
	}

	fields := make([]domain.TableField, 0, len(*resp.JSON200.Data.Fields))

	for _, f := range *resp.JSON200.Data.Fields {
		id := strings.TrimSpace(ptrStr(f.Id))
		if id == "" {
			continue
		}
		name := strings.TrimSpace(ptrStr(f.Name))
		if name == "" {
			name = strings.TrimSpace(ptrStr(f.Desc))
		}
		if name == "" {
			name = id
		}
		field := domain.TableField{
			ID:   id,
			Name: name,
			Type: domain.FieldType(*f.Type),
		}
		if f.Desc != nil {
			field.Description = strings.TrimSpace(*f.Desc)
		}

		if f.Property != nil {
			field.Property = *f.Property
		}

		fields = append(fields, field)
	}

	return fields, nil
}

// GetTableRecords получает записи таблицы
func (c *ClientWrapper) GetTableRecords(ctx context.Context, dstID, viewID string, pageSize, pageNum int) ([]domain.TableRecord, int, error) {
	fk := GetFusionV1DatasheetsDstIdRecordsParamsFieldKeyName
	params := &GetFusionV1DatasheetsDstIdRecordsParams{
		PageSize: &pageSize,
		PageNum:  &pageNum,
		FieldKey: &fk,
	}

	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.GetFusionV1DatasheetsDstIdRecordsWithResponse(ctx, dstID, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get records: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, 0, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON200 == nil || resp.JSON200.Data == nil {
		return nil, 0, fmt.Errorf("empty response data")
	}

	data := resp.JSON200.Data

	var records []domain.TableRecord
	if data.Records != nil {
		records = make([]domain.TableRecord, 0, len(*data.Records))

		for _, r := range *data.Records {
			if r.RecordId == nil {
				continue
			}

			record := domain.TableRecord{
				RecordID: *r.RecordId,
				Fields:   make(map[string]interface{}),
			}

			if r.Fields != nil {
				for k, v := range *r.Fields {
					record.Fields[k] = v
				}
			}

			if r.CreatedAt != nil {
				t := time.UnixMilli(int64(*r.CreatedAt))
				record.CreatedAt = &t
			}

			if r.UpdatedAt != nil {
				t := time.UnixMilli(int64(*r.UpdatedAt))
				record.UpdatedAt = &t
			}

			records = append(records, record)
		}
	} else {
		records = []domain.TableRecord{}
	}

	total := 0
	if data.Total != nil {
		total = *data.Total
	}

	return records, total, nil
}

// CreateRecords создает новые записи в таблице
func (c *ClientWrapper) CreateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordFields) ([]domain.TableRecord, error) {
	fieldKey := "name" // используются имена полей вместо ID

	requestBody := &CreateRecordsRequest{
		FieldKey: fieldKey,
		Records: make([]struct {
			Fields *map[string]interface{} `json:"fields,omitempty"`
		}, len(records)),
	}

	for i, r := range records {
		fields := r.Fields
		requestBody.Records[i] = struct {
			Fields *map[string]interface{} `json:"fields,omitempty"`
		}{
			Fields: &fields,
		}
	}

	params := &PostFusionV1DatasheetsDstIdRecordsParams{}
	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.PostFusionV1DatasheetsDstIdRecordsWithResponse(ctx, dstID, params, *requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create records: %w", err)
	}

	if resp.StatusCode() != 201 {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON201 == nil || resp.JSON201.Data == nil {
		return nil, fmt.Errorf("empty response data")
	}

	return c.convertToTableRecords(resp.JSON201.Data.Records), nil
}

func (c *ClientWrapper) UpdateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordUpdate) ([]domain.TableRecord, error) {
	fieldKey := "name"

	requestBody := UpdateRecordsRequest{
		FieldKey: fieldKey,
		Records: make([]struct {
			Fields   *map[string]interface{} `json:"fields,omitempty"`
			RecordId *string                 `json:"recordId,omitempty"`
		}, len(records)),
	}

	for i, r := range records {
		recordID := r.RecordID
		fields := r.Fields
		requestBody.Records[i] = struct {
			Fields   *map[string]interface{} `json:"fields,omitempty"`
			RecordId *string                 `json:"recordId,omitempty"`
		}{
			RecordId: &recordID,
			Fields:   &fields,
		}
	}

	params := &PatchFusionV1DatasheetsDstIdRecordsParams{}
	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.PatchFusionV1DatasheetsDstIdRecordsWithResponse(ctx, dstID, params, requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to update records: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON200 == nil || resp.JSON200.Data == nil {
		return nil, fmt.Errorf("empty response data")
	}

	return c.convertToTableRecords(resp.JSON200.Data.Records), nil
}

// DeleteRecords удаляет записи из таблицы
func (c *ClientWrapper) DeleteRecords(ctx context.Context, dstID string, recordIDs []string) error {
	params := &DeleteFusionV1DatasheetsDstIdRecordsParams{
		RecordIds: recordIDs,
	}

	resp, err := c.genClient.DeleteFusionV1DatasheetsDstIdRecordsWithResponse(ctx, dstID, params)
	if err != nil {
		return fmt.Errorf("failed to delete records: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	return nil
}

// convertToTableRecords преобразует записи из API в доменные модели
func (c *ClientWrapper) convertToTableRecords(apiRecords *[]Record) []domain.TableRecord {
	if apiRecords == nil {
		return []domain.TableRecord{}
	}

	records := make([]domain.TableRecord, 0, len(*apiRecords))

	for _, r := range *apiRecords {
		if r.RecordId == nil {
			continue
		}

		record := domain.TableRecord{
			RecordID: *r.RecordId,
			Fields:   make(map[string]interface{}),
		}

		if r.Fields != nil {
			for k, v := range *r.Fields {
				record.Fields[k] = v
			}
		}

		if r.CreatedAt != nil {
			t := time.UnixMilli(int64(*r.CreatedAt))
			record.CreatedAt = &t
		}

		if r.UpdatedAt != nil {
			t := time.UnixMilli(int64(*r.UpdatedAt))
			record.UpdatedAt = &t
		}

		records = append(records, record)
	}

	return records
}
