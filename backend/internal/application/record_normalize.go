package application

import (
	"strings"

	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/table/domain"
)

// normalizeRecordFieldsForFusion приводит значения к ожиданиям Fusion API при записи.
// Пустая строка для Attachment/MultiSelect/Member даёт 400 («должен быть массивом»).
func normalizeRecordFieldsForFusion(schema []domain.TableField, fields map[string]interface{}) map[string]interface{} {
	if fields == nil {
		return nil
	}
	out := make(map[string]interface{}, len(fields))
	for k, v := range fields {
		out[k] = v
	}
	for _, f := range schema {
		for _, key := range fieldMatchKeys(f) {
			v, ok := out[key]
			if !ok {
				continue
			}
			out[key] = coerceFusionCellValue(f.Type, v)
		}
	}
	return out
}

func fieldMatchKeys(f domain.TableField) []string {
	if f.Name != "" && f.ID != "" && f.Name == f.ID {
		return []string{f.Name}
	}
	var keys []string
	if f.Name != "" {
		keys = append(keys, f.Name)
	}
	if f.ID != "" && f.ID != f.Name {
		keys = append(keys, f.ID)
	}
	return keys
}

func isEmptyFusionCell(v interface{}) bool {
	if v == nil {
		return true
	}
	s, ok := v.(string)
	if ok {
		return strings.TrimSpace(s) == ""
	}
	return false
}

func coerceFusionCellValue(t domain.FieldType, v interface{}) interface{} {
	if !isEmptyFusionCell(v) {
		return v
	}
	switch t {
	case domain.FieldTypeAttachment, domain.FieldTypeMultiSelect, domain.FieldTypeMember:
		return []interface{}{}
	case domain.FieldTypeCheckbox:
		return false
	case domain.FieldTypeNumber, domain.FieldTypeCurrency, domain.FieldTypePercent, domain.FieldTypeRating, domain.FieldTypeDateTime:
		return nil
	default:
		return v
	}
}

