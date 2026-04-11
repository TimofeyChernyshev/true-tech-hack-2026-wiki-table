package mwsclient

import (
	"context"
	"fmt"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/domain"

	"github.com/go-resty/resty/v2"
)

type ClientWrapper struct {
	genClient  *ClientWithResponses
	httpClient *resty.Client
	baseURL    string
	apiKey     string
}

func NewClientWrapper(baseURL, apiKey string, requestTimeout time.Duration) (*ClientWrapper, error) {
	httpClient := resty.New().
		SetBaseURL(baseURL).
		SetTimeout(requestTimeout).
		SetAuthScheme("Bearer").
		SetAuthToken(apiKey).
		SetHeader("Content-Type", "application/json").
		OnAfterResponse(func(_ *resty.Client, r *resty.Response) error {
			if r.IsError() {
				return fmt.Errorf("http error: status=%s, body=%s", r.Status(), string(r.Body()))
			}

			return nil
		})

	genClient, err := NewClientWithResponses(baseURL, WithHTTPClient(httpClient.GetClient()))
	if err != nil {
		return nil, fmt.Errorf("failed to create generated client: %w", err)
	}

	return &ClientWrapper{
		httpClient: httpClient,
		baseURL:    baseURL,
		apiKey:     apiKey,
		genClient:  genClient,
	}, nil
}

// GetTableInfo получает информацию о таблице по её ID
func (c *ClientWrapper) GetTableInfo(ctx context.Context, dstID string) (*domain.TableInfo, error) {
	params := &GetNodeDetailsParams{
		Authorization: "Bearer " + c.apiKey,
	}

	resp, err := c.genClient.GetNodeDetailsWithResponse(ctx, dstID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get node details: %w", err)
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
		field := domain.TableField{
			ID:          *f.Id,
			Name:        *f.Name,
			Type:        domain.FieldType(*f.Type),
			Description: *f.Desc,
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
	params := &GetFusionV1DatasheetsDstIdRecordsParams{
		PageSize: &pageSize,
		PageNum:  &pageNum,
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
