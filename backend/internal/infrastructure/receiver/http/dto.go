package tableshttp

import "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/domain"

// TableDataResponse представляет ответ API
type TableDataResponse struct {
	TableID    string                `json:"tableId"`
	TableName  string                `json:"tableName,omitempty"`
	Fields     []domain.TableField   `json:"fields"`
	Records    []TableRecordResponse `json:"records"`
	Pagination PaginationResponse    `json:"pagination"`
}

// TableRecordResponse представляет запись в ответе API
type TableRecordResponse struct {
	RecordID  string                 `json:"recordId"`
	Fields    map[string]interface{} `json:"fields"`
	CreatedAt *int64                 `json:"createdAt,omitempty"`
	UpdatedAt *int64                 `json:"updatedAt,omitempty"`
}

// PaginationResponse представляет информацию о пагинации
type PaginationResponse struct {
	PageNum  int  `json:"pageNum"`
	PageSize int  `json:"pageSize"`
	Total    int  `json:"total"`
	HasMore  bool `json:"hasMore"`
}

// NewTableDataResponse создает ответ из доменной сущности
func NewTableDataResponse(data *domain.TableData) *TableDataResponse {
	records := make([]TableRecordResponse, len(data.Records))
	for i, r := range data.Records {
		record := TableRecordResponse{
			RecordID: r.RecordID,
			Fields:   r.Fields,
		}

		if r.CreatedAt != nil {
			ts := r.CreatedAt.UnixMilli()
			record.CreatedAt = &ts
		}

		if r.UpdatedAt != nil {
			ts := r.UpdatedAt.UnixMilli()
			record.UpdatedAt = &ts
		}

		records[i] = record
	}

	return &TableDataResponse{
		TableID:   data.TableID,
		TableName: data.TableName,
		Fields:    data.Fields,
		Records:   records,
		Pagination: PaginationResponse{
			PageNum:  data.Pagination.PageNum,
			PageSize: data.Pagination.PageSize,
			Total:    data.Pagination.Total,
			HasMore:  data.Pagination.HasMore,
		},
	}
}

// ErrorResponse представляет ответ с ошибкой
type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}
