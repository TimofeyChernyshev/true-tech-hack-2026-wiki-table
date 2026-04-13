package mwsclient

import (
	"context"
	"fmt"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/table/domain"
)

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
