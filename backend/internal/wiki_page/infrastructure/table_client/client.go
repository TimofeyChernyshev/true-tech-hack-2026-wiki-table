package tableclient

import (
	"context"
	"fmt"
	"log/slog"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/domain"

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
