package domain

import "time"

type TableRecord struct {
	RecordID  string                 `json:"recordId"`
	Fields    map[string]interface{} `json:"fields"`
	CreatedAt *time.Time             `json:"createdAt,omitempty"`
	UpdatedAt *time.Time             `json:"updatedAt,omitempty"`
}

// GetFieldValue возвращает значение поля по его ID или имени
func (r *TableRecord) GetFieldValue(fieldID string) interface{} {
	if val, ok := r.Fields[fieldID]; ok {
		return val
	}
	return nil
}
