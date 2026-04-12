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

	// CreateRecords создает новые записи в таблице
	CreateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordFields) ([]domain.TableRecord, error)

	// UpdateRecords обновляет существующие записи в таблице
	UpdateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordUpdate) ([]domain.TableRecord, error)

	// DeleteRecords удаляет записи из таблицы
	DeleteRecords(ctx context.Context, dstID string, recordIDs []string) error
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

	recordCount := len(records)
	hasMore := false
	if total > 0 {
		hasMore = pageNum*pageSize < total
	} else {
		// Fusion иногда не возвращает total — догружаем страницы, пока приходит полный pageSize.
		hasMore = recordCount >= pageSize
	}

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

// CreateRecords создает новые записи в таблице
func (s *TableService) CreateRecords(ctx context.Context, dstID string, viewID string, records []domain.RecordFields) ([]domain.TableRecord, error) {
	slog.Debug("Creating records", "dstId", dstID, "viewId", viewID, "count", len(records))

	createdRecords, err := s.tableClient.CreateRecords(ctx, dstID, viewID, records)
	if err != nil {
		return nil, fmt.Errorf("failed to create records: %w", err)
	}

	return createdRecords, nil
}

// UpdateRecords обновляет существующие записи в таблице
func (s *TableService) UpdateRecords(ctx context.Context, dstID string, viewID string, records []domain.RecordUpdate) ([]domain.TableRecord, error) {
	slog.Debug("Updating records", "dstId", dstID, "viewId", viewID, "count", len(records))

	updatedRecords, err := s.tableClient.UpdateRecords(ctx, dstID, viewID, records)
	if err != nil {
		return nil, fmt.Errorf("failed to update records: %w", err)
	}

	return updatedRecords, nil
}

// DeleteRecords удаляет записи из таблицы
func (s *TableService) DeleteRecords(ctx context.Context, dstID string, recordIDs []string) error {
	slog.Debug("Deleting records", "dstId", dstID, "count", len(recordIDs))

	if err := s.tableClient.DeleteRecords(ctx, dstID, recordIDs); err != nil {
		return fmt.Errorf("failed to delete records: %w", err)
	}

	return nil
}
