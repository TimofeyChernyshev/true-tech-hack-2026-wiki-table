package domain

// TableField представляет поле (колонку) таблицы
type TableField struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Type        FieldType     `json:"type"`
	Description string        `json:"description,omitempty"`
	Property    FieldProperty `json:"property,omitempty"`
}
