package domain

type FieldType string

const (
	FieldTypeSingleText   FieldType = "SingleText"
	FieldTypeText         FieldType = "Text"
	FieldTypeSingleSelect FieldType = "SingleSelect"
	FieldTypeMultiSelect  FieldType = "MultiSelect"
	FieldTypeNumber       FieldType = "Number"
	FieldTypeCurrency     FieldType = "Currency"
	FieldTypePercent      FieldType = "Percent"
	FieldTypeDateTime     FieldType = "DateTime"
	FieldTypeAttachment   FieldType = "Attachment"
	FieldTypeMember       FieldType = "Member"
	FieldTypeCheckbox     FieldType = "Checkbox"
	FieldTypeRating       FieldType = "Rating"
	FieldTypeURL          FieldType = "URL"
	FieldTypePhone        FieldType = "Phone"
	FieldTypeEmail        FieldType = "Email"
)
