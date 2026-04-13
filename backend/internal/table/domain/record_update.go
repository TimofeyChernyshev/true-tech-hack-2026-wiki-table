package domain

type RecordUpdate struct {
	RecordID string                 `json:"recordId"`
	Fields   map[string]interface{} `json:"fields"`
}
