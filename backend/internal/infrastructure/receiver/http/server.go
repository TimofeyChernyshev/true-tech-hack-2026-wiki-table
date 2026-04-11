package tableshttp

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/domain"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Server struct {
	router       *gin.Engine
	httpServer   *http.Server
	tableService TableService
	port         string
}

type TableService interface {
	GetTableData(ctx context.Context, dstID, viewID string, pageNum, pageSize int) (*domain.TableData, error)
}

func NewServer(tableService TableService, allowOrigins []string, port string, readTimeout time.Duration) *Server {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()

	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	server := &Server{
		router:       router,
		tableService: tableService,
		port:         port,
	}

	server.httpServer = &http.Server{
		Addr:        ":" + port,
		Handler:     router,
		ReadTimeout: readTimeout,
	}

	server.registerRoutes()

	return server
}

func (s *Server) registerRoutes() {
	// Health check
	s.router.GET("/health", s.healthCheck)
	s.router.HEAD("/health", s.healthCheck)

	// API v1 группа
	v1 := s.router.Group("/api/v1")
	{
		// Эндпоинт для получения записей таблицы
		v1.GET("/tables/:dstId/records", s.getTableRecords)
	}
}

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Unix(),
	})
}

func (s *Server) getTableRecords(c *gin.Context) {
	dstID, viewID, pageNum, pageSize, err := parseGetTableDataParams(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "Invalid request parameters",
			Details: err.Error(),
		})
		return
	}

	tableData, err := s.tableService.GetTableData(c.Request.Context(), dstID, viewID, pageNum, pageSize)
	if err != nil {
		s.handleError(c, err)
	}

	c.JSON(http.StatusOK, NewTableDataResponse(tableData))
}

func (s *Server) handleError(c *gin.Context, err error) {
	slog.Error("Failed to get table data", "error", err)

	c.JSON(http.StatusInternalServerError, ErrorResponse{
		Code:    http.StatusInternalServerError,
		Message: "Internal server error",
	})
}

func (s *Server) Start() error {
	if err := s.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("shutdown error: %w", err)
	}

	return nil
}

func (s *Server) GetRouter() *gin.Engine {
	return s.router
}

// parseGetTableDataParams парсит параметры из gin.Context
// Returns: dstID string, viewID string, pageNum int, pageSize int, err error
func parseGetTableDataParams(c *gin.Context) (string, string, int, int, error) {
	dstID := c.Param("dstId")
	viewID := c.Query("viewId")
	var err error
	var pageSize, pageNum int

	if pageSizeStr := c.Query("pageSize"); pageSizeStr != "" {
		pageSize, err = strconv.Atoi(pageSizeStr)
		if err != nil {
			return "", "", 0, 0, fmt.Errorf("cannot convert pageSize to integer: %w", err)
		}
	}

	if pageNumStr := c.Query("pageNum"); pageNumStr != "" {
		pageNum, err = strconv.Atoi(pageNumStr)
		if err != nil {
			return "", "", 0, 0, fmt.Errorf("cannot convert pageNum to integer: %w", err)
		}
	}

	return dstID, viewID, pageNum, pageSize, nil
}
