package application

import (
	"context"
	"fmt"
	"log/slog"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/domain"
)

type TableClient interface {
	// GetTableInfo получает информацию о таблице по её ID
	GetTableInfo(ctx context.Context, dstID string) (*domain.TableInfo, error)

	// GetTableFields получает поля таблицы
	GetTableFields(ctx context.Context, dstID, viewID string) ([]domain.TableField, error)

	// GetTableRecords получает записи таблицы
	GetTableRecords(ctx context.Context, dstID, viewID string, pageNum, pageSize int) ([]domain.TableRecord, int, error)
}

type TableService struct {
	tableClient TableClient
}

func NewTableService(tableClient TableClient) *TableService {
	return &TableService{
		tableClient: tableClient,
	}
}

// GetTableData получает все необходимые данные для отображения таблицы
func (s *TableService) GetTableData(ctx context.Context, dstID, viewID string, pageNum, pageSize int) (*domain.TableData, error) {
	slog.Debug("Getting table data", "dstId", dstID, "viewId", viewID, "pageNum", pageNum, "pageSize", pageSize)

	tableInfo, err := s.tableClient.GetTableInfo(ctx, dstID)
	if err != nil {
		return nil, fmt.Errorf("failed to get table info: %w", err)
	}

	fields, err := s.tableClient.GetTableFields(ctx, dstID, viewID)
	if err != nil {
		return nil, fmt.Errorf("failed to get table fields: %w", err)
	}

	records, total, err := s.tableClient.GetTableRecords(ctx, dstID, viewID, pageNum, pageSize)
	if err != nil {
		return nil, fmt.Errorf("failed to get table records: %w", err)
	}

	hasMore := pageNum*pageSize < total

	return &domain.TableData{
		TableID:   dstID,
		TableName: tableInfo.Name,
		Fields:    fields,
		Records:   records,
		Pagination: domain.Pagination{
			PageNum:  pageNum,
			PageSize: pageSize,
			Total:    total,
			HasMore:  hasMore,
		},
	}, nil
}
