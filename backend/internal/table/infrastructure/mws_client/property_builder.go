package mwsclient

import (
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/table/domain"
)

// buildFieldCreateProperty создаёт FieldCreateProperty для конкретного типа поля
func (c *ClientWrapper) buildFieldCreateProperty(fieldType domain.FieldType, prop domain.FieldProperty) FieldCreateProperty {
	var result FieldCreateProperty
	propMap := prop.GetMap()

	switch fieldType {
	case domain.FieldTypeSingleText:
		p := c.buildSingleTextStruct(propMap)
		result.FromSingleTextProperty(p)

	case domain.FieldTypeText:
		p := c.buildTextStruct(propMap)
		result.FromTextProperty(p)

	case domain.FieldTypeSingleSelect:
		p := c.buildSingleSelectStruct(propMap)
		result.FromSingleSelectProperty(p)

	case domain.FieldTypeMultiSelect:
		p := c.buildMultiSelectStruct(propMap)
		result.FromMultiSelectProperty(p)

	case domain.FieldTypeNumber:
		p := c.buildNumberStruct(propMap)
		result.FromNumberProperty(p)

	case domain.FieldTypeCurrency:
		p := c.buildCurrencyStruct(propMap)
		result.FromCurrencyProperty(p)

	case domain.FieldTypePercent:
		p := c.buildPercentStruct(propMap)
		result.FromPercentProperty(p)

	case domain.FieldTypeDateTime:
		p := c.buildDateTimeStruct(propMap)
		result.FromDateTimeProperty(p)

	case domain.FieldTypeAttachment:
		var p AttachmentProperty
		result.FromAttachmentProperty(p)

	case domain.FieldTypeMember:
		p := c.buildMemberStruct(propMap)
		result.FromMemberProperty(p)

	case domain.FieldTypeCheckbox:
		p := c.buildCheckboxStruct(propMap)
		result.FromCheckboxProperty(p)

	case domain.FieldTypeRating:
		p := c.buildRatingStruct(propMap)
		result.FromRatingProperty(p)

	case domain.FieldTypeURL, domain.FieldTypePhone, domain.FieldTypeEmail:
		p := SingleTextProperty{}
		result.FromSingleTextProperty(p)

	default:
		var p SingleTextProperty
		result.FromSingleTextProperty(p)
	}

	return result
}

func (c *ClientWrapper) buildSingleTextStruct(propMap map[string]interface{}) SingleTextProperty {
	p := SingleTextProperty{}
	if v, ok := propMap["defaultValue"].(string); ok && v != "" {
		p.DefaultValue = &v
	}
	return p
}

func (c *ClientWrapper) buildTextStruct(propMap map[string]interface{}) TextProperty {
	p := TextProperty{}
	return p
}

func (c *ClientWrapper) buildSingleSelectStruct(propMap map[string]interface{}) SingleSelectProperty {
	p := SingleSelectProperty{}

	if options, ok := propMap["options"].([]interface{}); ok && len(options) > 0 {
		p.Options = c.convertToSelectOptions(options)
	}
	if v, ok := propMap["defaultValue"].(string); ok && v != "" {
		p.DefaultValue = &v
	}

	return p
}

func (c *ClientWrapper) buildMultiSelectStruct(propMap map[string]interface{}) MultiSelectProperty {
	p := MultiSelectProperty{}

	if options, ok := propMap["options"].([]interface{}); ok && len(options) > 0 {
		p.Options = c.convertToSelectOptions(options)
	}
	if v, ok := propMap["defaultValue"].(string); ok && v != "" {
		p.DefaultValue = &v
	}

	return p
}

func (c *ClientWrapper) buildNumberStruct(propMap map[string]interface{}) NumberProperty {
	p := NumberProperty{}

	if v, ok := propMap["precision"].(float64); ok {
		precision := int(v)
		p.Precision = &precision
	} else if v, ok := propMap["precision"].(int); ok {
		p.Precision = &v
	}
	if v, ok := propMap["defaultValue"].(string); ok && v != "" {
		p.DefaultValue = &v
	}

	return p
}

func (c *ClientWrapper) buildCurrencyStruct(propMap map[string]interface{}) CurrencyProperty {
	p := CurrencyProperty{}

	if v, ok := propMap["precision"].(float64); ok {
		precision := int(v)
		p.Precision = &precision
	} else if v, ok := propMap["precision"].(int); ok {
		p.Precision = &v
	}
	if v, ok := propMap["symbol"].(string); ok && v != "" {
		p.Symbol = &v
	}
	if v, ok := propMap["defaultValue"].(string); ok && v != "" {
		p.DefaultValue = &v
	}

	return p
}

func (c *ClientWrapper) buildPercentStruct(propMap map[string]interface{}) PercentProperty {
	p := PercentProperty{}

	if v, ok := propMap["precision"].(float64); ok {
		precision := int(v)
		p.Precision = &precision
	} else if v, ok := propMap["precision"].(int); ok {
		p.Precision = &v
	}
	if v, ok := propMap["defaultValue"].(string); ok && v != "" {
		p.DefaultValue = &v
	}

	return p
}

func (c *ClientWrapper) buildDateTimeStruct(propMap map[string]interface{}) DateTimeProperty {
	p := DateTimeProperty{}

	if v, ok := propMap["dateFormat"].(string); ok && v != "" {
		format := DateTimePropertyDateFormat(v)
		p.DateFormat = &format
	}
	if v, ok := propMap["includeTime"].(bool); ok {
		p.IncludeTime = &v
	}
	if v, ok := propMap["autoFill"].(bool); ok {
		p.AutoFill = &v
	}

	return p
}

func (c *ClientWrapper) buildMemberStruct(propMap map[string]interface{}) MemberProperty {
	p := MemberProperty{}

	if v, ok := propMap["isMulti"].(bool); ok {
		p.IsMulti = &v
	}
	if v, ok := propMap["shouldSendMsg"].(bool); ok {
		p.ShouldSendMsg = &v
	}

	return p
}

func (c *ClientWrapper) buildCheckboxStruct(propMap map[string]interface{}) CheckboxProperty {
	p := CheckboxProperty{}

	if v, ok := propMap["icon"].(string); ok && v != "" {
		p.Icon = &v
	}

	return p
}

func (c *ClientWrapper) buildRatingStruct(propMap map[string]interface{}) RatingProperty {
	p := RatingProperty{}

	if v, ok := propMap["icon"].(string); ok && v != "" {
		p.Icon = &v
	}
	if v, ok := propMap["max"].(float64); ok {
		maxVal := int(v)
		p.Max = &maxVal
	} else if v, ok := propMap["max"].(int); ok {
		p.Max = &v
	}

	return p
}

// convertToSelectOptions преобразует []interface{} в сгенерированный тип
func (c *ClientWrapper) convertToSelectOptions(options []interface{}) *[]struct {
	Color *string `json:"color,omitempty"`
	Name  *string `json:"name,omitempty"`
} {
	if len(options) == 0 {
		return nil
	}

	result := make([]struct {
		Color *string `json:"color,omitempty"`
		Name  *string `json:"name,omitempty"`
	}, 0, len(options))

	for _, opt := range options {
		optMap, ok := opt.(map[string]interface{})
		if !ok {
			continue
		}

		item := struct {
			Color *string `json:"color,omitempty"`
			Name  *string `json:"name,omitempty"`
		}{}

		if name, ok := optMap["name"].(string); ok && name != "" {
			item.Name = &name
		}
		if color, ok := optMap["color"].(string); ok && color != "" {
			item.Color = &color
		}

		result = append(result, item)
	}

	return &result
}

// getDefaultProperty возвращает базовые property для каждого типа поля
func (c *ClientWrapper) getDefaultProperty(fieldType domain.FieldType) domain.FieldProperty {
	switch fieldType {
	case domain.FieldTypeSingleText, domain.FieldTypeText,
		domain.FieldTypeURL, domain.FieldTypePhone, domain.FieldTypeEmail:
		return domain.FieldProperty{}

	case domain.FieldTypeSingleSelect, domain.FieldTypeMultiSelect:
		return domain.FieldProperty{
			"options": []map[string]interface{}{
				{"name": "Опция 1", "color": "#3B82F6"},
			},
		}

	case domain.FieldTypeNumber:
		return domain.FieldProperty{
			"precision": 0,
		}

	case domain.FieldTypeCurrency:
		return domain.FieldProperty{
			"precision": 2,
			"symbol":    "₽",
		}

	case domain.FieldTypePercent:
		return domain.FieldProperty{
			"precision": 0,
		}

	case domain.FieldTypeDateTime:
		return domain.FieldProperty{
			"dateFormat":  "YYYY-MM-DD",
			"includeTime": false,
		}

	case domain.FieldTypeRating:
		return domain.FieldProperty{
			"max":  5,
			"icon": "star",
		}

	case domain.FieldTypeCheckbox:
		return domain.FieldProperty{
			"icon": "check",
		}

	case domain.FieldTypeMember:
		return domain.FieldProperty{
			"isMulti": false,
		}

	case domain.FieldTypeAttachment:
		return domain.FieldProperty{}

	default:
		return domain.FieldProperty{}
	}
}
