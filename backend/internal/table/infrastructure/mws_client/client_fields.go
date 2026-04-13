package mwsclient

import (
	"context"
	"fmt"
	"log/slog"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/table/domain"
)

// GetTableFields получает поля таблицы
func (c *ClientWrapper) GetTableFields(ctx context.Context, dstID, viewID string) ([]domain.TableField, error) {
	params := &GetFusionV1DatasheetsDstIdFieldsParams{}

	if viewID != "" {
		params.ViewId = &viewID
	}

	resp, err := c.genClient.GetFusionV1DatasheetsDstIdFieldsWithResponse(ctx, dstID, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get fields: %w", err)
	}

	if resp.JSON200 == nil || resp.JSON200.Data == nil {
		return nil, fmt.Errorf("empty response data")
	}

	if resp.JSON200.Data.Fields == nil {
		return []domain.TableField{}, nil
	}

	fields := make([]domain.TableField, 0, len(*resp.JSON200.Data.Fields))

	for _, f := range *resp.JSON200.Data.Fields {
		field := domain.TableField{
			ID:   *f.Id,
			Name: *f.Name,
			Type: domain.FieldType(*f.Type),
		}

		if f.Property != nil {
			field.Property = *f.Property
		}
		if f.Desc != nil {
			field.Description = *f.Desc
		}

		fields = append(fields, field)
	}

	return fields, nil
}

// CreateField создает новое поле в таблице
func (c *ClientWrapper) CreateField(
	ctx context.Context,
	spaceID, dstID, fieldName string,
	fieldType domain.FieldType,
	fieldProperty domain.FieldProperty,
) (*domain.TableField, error) {
	fieldTypeEnum := FieldTypeEnum(fieldType)

	if fieldProperty == nil {
		fieldProperty = c.getDefaultProperty(fieldType)
	}

	body := CreateFieldRequest{
		Name: &fieldName,
		Type: &fieldTypeEnum,
	}

	prop := c.buildFieldCreateProperty(fieldType, fieldProperty)
	body.Property = &prop

	resp, err := c.genClient.PostFusionV1SpacesSpaceIdDatasheetsDstIdFieldsWithResponse(ctx, spaceID, dstID, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create field: %w", err)
	}

	slog.Debug("resp", "code", resp.StatusCode())

	var id string
	if resp.JSON200 != nil && resp.JSON200.Data != nil {
		id = *resp.JSON200.Data.Id
	} else {
		slog.Warn("cannot get created field id", "name", fieldName, "dstID", dstID)
	}

	return &domain.TableField{
		ID:   id,
		Name: fieldName,
		Type: fieldType,
	}, nil
}

// DeleteField удаляет поле из таблицы
func (c *ClientWrapper) DeleteField(ctx context.Context, spaceID, dstID, fieldID string) error {
	resp, err := c.genClient.DeleteFusionV1SpacesSpaceIdDatasheetsDstIdFieldsFieldIdWithResponse(ctx, spaceID, dstID, fieldID)
	if err != nil {
		return fmt.Errorf("failed to delete field: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	return nil
}

// UpdateFieldIndex изменяет порядок поля в представлении
func (c *ClientWrapper) UpdateFieldIndex(ctx context.Context, dstID, viewID, fieldID string, index int) error {
	requestBody := &PatchFusionV1DatasheetsDstIdViewsViewIdFieldsFieldIdJSONRequestBody{
		Index: &index,
	}

	resp, err := c.genClient.PatchFusionV1DatasheetsDstIdViewsViewIdFieldsFieldIdWithResponse(ctx, dstID, viewID, fieldID, *requestBody)
	if err != nil {
		return fmt.Errorf("failed to update index: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	return nil
}
