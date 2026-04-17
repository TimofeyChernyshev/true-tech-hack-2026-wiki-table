package application

import (
	"context"
	"log/slog"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/domain"
)

type TableClient interface {
	UpdateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordUpdate) error
}

type WikiService struct {
	tableClient TableClient
}

func NewWikiService(tableClient TableClient) *WikiService {
	return &WikiService{tableClient: tableClient}
}

func (s *WikiService) SaveRecords(ctx context.Context, dstID, viewID string, records []domain.RecordUpdate) error {
	if len(records) == 0 {
		slog.Debug("No records changed, skipping save")
		return nil
	}

	slog.Debug("Saving records", "count", len(records))

	return s.tableClient.UpdateRecords(ctx, dstID, viewID, records)
}

func (s *WikiService) SavePage(ctx context.Context, roomID string, content string) error {
	// TODO: добавить сохранение в БД
	return nil
}
