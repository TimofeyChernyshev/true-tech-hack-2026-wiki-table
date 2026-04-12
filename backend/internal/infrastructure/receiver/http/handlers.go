package tableshttp

import (
	"errors"
	"fmt"
	"net/http"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/domain"

	"github.com/gin-gonic/gin"
)

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Unix(),
	})
}

func (s *Server) GetTablesDstIdRecords(c *gin.Context, dstID string, params GetTablesDstIdRecordsParams) {
	viewID := ""
	if params.ViewId != nil {
		viewID = *params.ViewId
	}

	pageNum := 0
	if params.PageNum != nil {
		pageNum = *params.PageNum
	} else {
		s.handleError(c, errors.New("cannot get PageNum"))
		return
	}

	pageSize := 0
	if params.PageSize != nil {
		pageSize = *params.PageSize
	} else {
		s.handleError(c, errors.New("cannot get PageSize"))
		return
	}

	tableData, err := s.tableService.GetTableData(c.Request.Context(), dstID, viewID, pageNum, pageSize)
	if err != nil {
		s.handleError(c, err)
	}

	c.JSON(http.StatusOK, convertToTableDataResponse(tableData))
}

func (s *Server) PostTablesDstIdRecords(c *gin.Context, dstId string, params PostTablesDstIdRecordsParams) {
	var req CreateRecordsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errText := err.Error()
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Invalid request body",
			Details: &errText,
		})
		return
	}

	viewID := ""
	if params.ViewId != nil {
		viewID = *params.ViewId
	}

	records := make([]domain.RecordFields, len(req.Records))
	for i, r := range req.Records {
		records[i] = domain.RecordFields{Fields: r.Fields}
	}

	createdRecords, err := s.tableService.CreateRecords(c.Request.Context(), dstId, viewID, records)
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, convertToRecordsResponse(createdRecords))
}

func (s *Server) PatchTablesDstIdRecords(c *gin.Context, dstId string, params PatchTablesDstIdRecordsParams) {
	var req UpdateRecordsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errText := err.Error()
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Invalid request body",
			Details: &errText,
		})
		return
	}

	viewID := ""
	if params.ViewId != nil {
		viewID = *params.ViewId
	}

	records := make([]domain.RecordUpdate, len(req.Records))
	for i, r := range req.Records {
		records[i] = domain.RecordUpdate{
			RecordID: r.RecordId,
			Fields:   r.Fields,
		}
	}

	updatedRecords, err := s.tableService.UpdateRecords(c.Request.Context(), dstId, viewID, records)
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, convertToRecordsResponse(updatedRecords))
}

func (s *Server) DeleteTablesDstIdRecords(c *gin.Context, dstId string) {
	var req DeleteRecordsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errText := err.Error()
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Invalid request body",
			Details: &errText,
		})
		return
	}

	if err := s.tableService.DeleteRecords(c.Request.Context(), dstId, req.RecordIds); err != nil {
		s.handleError(c, err)
		return
	}

	success := true
	message := fmt.Sprintf("Deleted %d records", len(req.RecordIds))
	c.JSON(http.StatusOK, DeleteRecordsResponse{
		Success: &success,
		Message: &message,
	})
}

func convertToTableDataResponse(data *domain.TableData) TableDataResponse {
	fields := make([]TableField, len(data.Fields))
	for i, f := range data.Fields {
		desc := f.Description
		prop := f.Property.GetMap()
		fields[i] = TableField{
			Id:          f.ID,
			Name:        f.Name,
			Type:        TableFieldType(f.Type),
			Description: &desc,
			Property:    &prop,
		}
	}

	records := make([]TableRecord, len(data.Records))
	for i, r := range data.Records {
		record := TableRecord{
			RecordId: r.RecordID,
			Fields:   r.Fields,
		}
		if r.CreatedAt != nil {
			ts := r.CreatedAt.UnixMilli()
			record.CreatedAt = &ts
		}
		if r.UpdatedAt != nil {
			ts := r.UpdatedAt.UnixMilli()
			record.UpdatedAt = &ts
		}
		records[i] = record
	}

	tableName := data.TableName

	return TableDataResponse{
		TableId:   data.TableID,
		TableName: &tableName,
		Fields:    fields,
		Records:   records,
		Pagination: Pagination{
			PageNum:  data.Pagination.PageNum,
			PageSize: data.Pagination.PageSize,
			Total:    data.Pagination.Total,
			HasMore:  data.Pagination.HasMore,
		},
	}
}

func convertToRecordsResponse(records []domain.TableRecord) RecordsResponse {
	result := make([]TableRecord, len(records))
	for i, r := range records {
		record := TableRecord{
			RecordId: r.RecordID,
			Fields:   r.Fields,
		}
		if r.CreatedAt != nil {
			ts := r.CreatedAt.UnixMilli()
			record.CreatedAt = &ts
		}
		if r.UpdatedAt != nil {
			ts := r.UpdatedAt.UnixMilli()
			record.UpdatedAt = &ts
		}
		result[i] = record
	}
	return RecordsResponse{Records: result}
}
