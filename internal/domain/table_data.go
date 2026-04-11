package domain

// TableData представляет полные данные таблицы для отображения
type TableData struct {
	TableID    string        `json:"tableId"`
	TableName  string        `json:"tableName,omitempty"`
	Fields     []TableField  `json:"fields"`
	Records    []TableRecord `json:"records"`
	Pagination Pagination    `json:"pagination"`
}

// GetFieldByID находит поле по его ID
func (t *TableData) GetFieldByID(fieldID string) *TableField {
	for i := range t.Fields {
		if t.Fields[i].ID == fieldID {
			return &t.Fields[i]
		}
	}
	return nil
}

// GetFieldByName находит поле по его имени
func (t *TableData) GetFieldByName(name string) *TableField {
	for i := range t.Fields {
		if t.Fields[i].Name == name {
			return &t.Fields[i]
		}
	}
	return nil
}
