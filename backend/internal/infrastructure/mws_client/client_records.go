package mwsclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/domain"
)

// decodePostCreateRecordsData обрабатывает ответ POST /datasheets/{dstId}/records.
// Сгенерированный ParsePostFusionV1DatasheetsDstIdRecordsResponse заполняет JSON201 только при статусе 201;
// часть окружений MWS отвечает 200 OK с тем же телом — тогда JSON201 остаётся nil.
func decodePostCreateRecordsData(resp *PostFusionV1DatasheetsDstIdRecordsResponse) (*RecordsData, error) {
	if resp.JSON201 != nil && resp.JSON201.Data != nil {
		return resp.JSON201.Data, nil
	}
	code := resp.StatusCode()
	if code != http.StatusOK && code != http.StatusCreated {
		return nil, fmt.Errorf("unexpected status %d: %s", code, string(resp.Body))
	}
	if len(resp.Body) == 0 {
		return nil, fmt.Errorf("empty body (status %d)", code)
	}
	var envelope CreateRecordsResponse
	if err := json.Unmarshal(resp.Body, &envelope); err != nil {
		return nil, fmt.Errorf("json decode: %w; body=%s", err, string(resp.Body))
	}
	if envelope.Data == nil {
		if envelope.Message != nil && (envelope.Success == nil || (envelope.Success != nil && !*envelope.Success)) {
			return nil, fmt.Errorf("fusion: %s", *envelope.Message)
		}
		return nil, fmt.Errorf("response data is nil (status %d): %s", code, string(resp.Body))
	}
	return envelope.Data, nil
}

// GetTableRecords получает записи таблицы
func (c *ClientWrapper) GetTableRecords(ctx context.Context, dstID, viewID string, pageNum, pageSize int) ([]domain.TableRecord, int, error) {
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

	data, err := decodePostCreateRecordsData(resp)
	if err != nil {
		return nil, err
	}

	return c.convertToTableRecords(data.Records), nil
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
