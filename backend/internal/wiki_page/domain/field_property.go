package domain

type FieldProperty map[string]interface{}

// Возвращает FieldProperty в виде обычной go map
func (p FieldProperty) GetMap() map[string]interface{} {
	return p
}
