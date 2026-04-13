package tableclient

import (
	"context"
	"fmt"
	"log/slog"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki-page/domain"

	"github.com/go-resty/resty/v2"
)

type ClientWrapper struct {
	genClient  *ClientWithResponses
	httpClient *resty.Client
	baseURL    string
}

func NewClientWrapper(baseURL string, requestTimeout time.Duration) (*ClientWrapper, error) {
	httpClient := resty.New().
		SetBaseURL(baseURL).
		SetTimeout(requestTimeout).
		SetHeader("Content-Type", "application/json").
		SetRetryCount(2).
		SetRetryWaitTime(1 * time.Second).
		SetRetryMaxWaitTime(5 * time.Second).
		OnAfterResponse(func(_ *resty.Client, r *resty.Response) error {
			if r.IsError() {
				slog.Error("HTTP error", "status", r.Status(), "body", string(r.Body()))
				return fmt.Errorf("http error: status=%s, body=%s", r.Status(), string(r.Body()))
			}
			return nil
		})

	genClient, err := NewClientWithResponses(baseURL, WithHTTPClient(httpClient.GetClient()))
	if err != nil {
		return nil, fmt.Errorf("failed to create generated client: %w", err)
	}

	return &ClientWrapper{
		genClient:  genClient,
		httpClient: httpClient,
		baseURL:    baseURL,
	}, nil
}

// GetTableData получает данные таблицы
func (c *ClientWrapper) GetTableData(ctx context.Context, dstID, viewID string, pageNum, pageSize int) (*TableDataResponse, error) {
	params := &GetTablesDstIdRecordsParams{
		PageNum:  &pageNum,
		PageSize: &pageSize,
	}

	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.GetTablesDstIdRecordsWithResponse(ctx, dstID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get table data: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return resp.JSON200, nil
}

// CreateRecords создает новые записи
func (c *ClientWrapper) CreateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordFields) ([]TableRecord, error) {
	body := CreateRecordsRequest{
		Records: make([]struct {
			Fields map[string]interface{} `json:"fields"`
		}, len(records)),
	}

	for i, r := range records {
		body.Records[i].Fields = r.Fields
	}

	params := &PostTablesDstIdRecordsParams{}
	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.PostTablesDstIdRecordsWithResponse(ctx, dstID, params, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create records: %w", err)
	}

	if resp.StatusCode() != 201 {
		return nil, fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON201 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return resp.JSON201.Records, nil
}

// UpdateRecords обновляет записи
func (c *ClientWrapper) UpdateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordUpdate) ([]TableRecord, error) {
	body := UpdateRecordsRequest{
		Records: make([]struct {
			Fields   map[string]interface{} `json:"fields"`
			RecordId string                 `json:"recordId"`
		}, len(records)),
	}

	for i, r := range records {
		body.Records[i] = struct {
			Fields   map[string]interface{} `json:"fields"`
			RecordId string                 `json:"recordId"`
		}{
			Fields:   r.Fields,
			RecordId: r.RecordID,
		}
	}

	params := &PatchTablesDstIdRecordsParams{}
	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.PatchTablesDstIdRecordsWithResponse(ctx, dstID, params, body)
	if err != nil {
		return nil, fmt.Errorf("failed to update records: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return resp.JSON200.Records, nil
}

// DeleteRecords удаляет записи
func (c *ClientWrapper) DeleteRecords(ctx context.Context, dstID string, recordIDs []string) error {
	body := DeleteRecordsRequest{
		RecordIds: recordIDs,
	}

	resp, err := c.genClient.DeleteTablesDstIdRecordsWithResponse(ctx, dstID, body)
	if err != nil {
		return fmt.Errorf("failed to delete records: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	return nil
}

// CreateField создает новое поле
func (c *ClientWrapper) CreateField(
	ctx context.Context,
	spaceID, dstID, fieldName string,
	fieldType domain.FieldType,
	fieldProperty domain.FieldProperty,
) (*FieldResponse, error) {
	fp := fieldProperty.GetMap()

	body := CreateFieldRequest{
		Name:     fieldName,
		Type:     CreateFieldRequestType(fieldType),
		Property: &fp,
	}

	params := &PostTablesDstIdFieldsParams{
		SpaceId: spaceID,
	}

	resp, err := c.genClient.PostTablesDstIdFieldsWithResponse(ctx, dstID, params, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create field: %w", err)
	}

	if resp.StatusCode() != 201 {
		return nil, fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON201 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return &FieldResponse{
		Id:   resp.JSON201.Id,
		Name: resp.JSON201.Name,
		Type: resp.JSON201.Type,
	}, nil
}

// DeleteField удаляет поле
func (c *ClientWrapper) DeleteField(ctx context.Context, spaceID, dstID, fieldID string) error {
	params := &DeleteTablesDstIdFieldsFieldIdParams{
		SpaceId: spaceID,
	}

	resp, err := c.genClient.DeleteTablesDstIdFieldsFieldIdWithResponse(ctx, dstID, fieldID, params)
	if err != nil {
		return fmt.Errorf("failed to delete field: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	return nil
}

// UpdateFieldIndex изменяет порядок поля
func (c *ClientWrapper) UpdateFieldIndex(ctx context.Context, dstID, viewID, fieldID string, index int) error {
	body := PatchTablesDstIdViewsViewIdFieldsFieldIdIndexJSONRequestBody{
		Index: index,
	}

	resp, err := c.genClient.PatchTablesDstIdViewsViewIdFieldsFieldIdIndexWithResponse(ctx, dstID, viewID, fieldID, body)
	if err != nil {
		return fmt.Errorf("failed to update field index: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	return nil
}
