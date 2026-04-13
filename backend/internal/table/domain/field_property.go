package domain

import "fmt"

type FieldProperty map[string]interface{}

// Возвращает FieldProperty в виде обычной go map
func (p FieldProperty) GetMap() map[string]interface{} {
	return p
}

// SelectOption представляет опцию для полей выбора
type SelectOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

// GetSelectOptions извлекает опции для полей типа SingleSelect/MultiSelect
func (p FieldProperty) GetSelectOptions() ([]SelectOption, error) {
	optsRaw, ok := p["options"]
	if !ok {
		return nil, nil
	}

	optsArray, ok := optsRaw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid options format")
	}

	options := make([]SelectOption, 0, len(optsArray))
	for _, opt := range optsArray {
		optMap, ok := opt.(map[string]interface{})
		if !ok {
			continue
		}

		option := SelectOption{}
		if id, ok := optMap["id"].(string); ok {
			option.ID = id
		}
		if name, ok := optMap["name"].(string); ok {
			option.Name = name
		}
		if color, ok := optMap["color"].(string); ok {
			option.Color = color
		}

		options = append(options, option)
	}

	return options, nil
}

// GetDateTimeFormat извлекает настройки формата даты
func (p FieldProperty) GetDateTimeFormat() (dateFormat string, includeTime bool) {
	if format, ok := p["dateFormat"].(string); ok {
		dateFormat = format
	} else {
		dateFormat = "YYYY-MM-DD"
	}

	if include, ok := p["includeTime"].(bool); ok {
		includeTime = include
	}

	return dateFormat, includeTime
}

// GetNumberPrecision извлекает точность для числовых полей
func (p FieldProperty) GetNumberPrecision() int {
	if precision, ok := p["precision"].(float64); ok {
		return int(precision)
	}
	if precision, ok := p["precision"].(int); ok {
		return precision
	}
	return 0
}

// GetCurrencySymbol извлекает символ валюты
func (p FieldProperty) GetCurrencySymbol() string {
	if symbol, ok := p["symbol"].(string); ok {
		return symbol
	}
	return ""
}
