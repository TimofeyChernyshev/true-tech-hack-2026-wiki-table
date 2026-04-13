package application

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/domain"
)

type TableClient interface {
	UpdateRecords(ctx context.Context, dstID string, records []domain.RecordUpdate) error
}

type WikiService struct {
	httpClient TableClient
}

func NewWikiService(httpClient TableClient) *WikiService {
	return &WikiService{httpClient: httpClient}
}

func (s *WikiService) SaveRecords(ctx context.Context, dstID string, state, previousState []byte) error {
	var currentRecords []domain.RecordUpdate
	if err := json.Unmarshal(state, &currentRecords); err != nil {
		return fmt.Errorf("failed to unmarshal records: %w", err)
	}

	var previousRecords []domain.RecordUpdate
	if len(previousState) > 0 {
		json.Unmarshal(previousState, &previousRecords)
	}

	updated := s.findUpdatedRecords(previousRecords, currentRecords)

	if len(updated) == 0 {
		slog.Debug("No records changed, skipping save")
		return nil
	}

	slog.Debug("Saving records", "count", len(updated))

	return s.httpClient.UpdateRecords(ctx, dstID, updated)
}

func (s *WikiService) findUpdatedRecords(previous, current []domain.RecordUpdate) []domain.RecordUpdate {
	prevMap := make(map[string]domain.RecordUpdate)
	for _, r := range previous {
		prevMap[r.RecordID] = r
	}

	var updated []domain.RecordUpdate
	for _, curr := range current {
		if curr.RecordID == "" {
			continue
		}

		prev, exists := prevMap[curr.RecordID]
		if !exists {
			continue
		}

		if !s.recordsEqual(prev.Fields, curr.Fields) {
			updated = append(updated, curr)
		}
	}

	return updated
}

func (s *WikiService) recordsEqual(a, b map[string]interface{}) bool {
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}

func (s *WikiService) SavePage(roomID string, state []byte) error {
	// TODO: добавить сохранение в БД
	return nil
}
