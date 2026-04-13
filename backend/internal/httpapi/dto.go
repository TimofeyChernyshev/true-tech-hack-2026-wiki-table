package httpapi

// TableRecordsResponse соответствует схеме back-front.yaml (components.schemas.TableRecordsResponse).
type TableRecordsResponse struct {
	PageNum  int           `json:"pageNum"`
	PageSize int           `json:"pageSize"`
	Records  []TableRecord `json:"records"`
}

// TableRecord соответствует схеме TableRecord.
type TableRecord struct {
	RecordId  string                 `json:"recordId"`
	Fields    map[string]interface{} `json:"fields"`
	CreatedAt *int64                 `json:"createdAt,omitempty"`
	UpdatedAt *int64                 `json:"updatedAt,omitempty"`
}

// ErrorResponse соответствует схеме ErrorResponse.
type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}
