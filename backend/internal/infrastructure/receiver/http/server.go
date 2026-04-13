package tableshttp

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
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
	wikiDataDir  string
}

type TableService interface {
	GetTableData(ctx context.Context, dstID, viewID string, pageNum, pageSize int) (*domain.TableData, error)

	CreateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordFields) ([]domain.TableRecord, error)
	UpdateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordUpdate) ([]domain.TableRecord, error)
	DeleteRecords(ctx context.Context, dstID string, recordIDs []string) error

	CreateField(ctx context.Context, spaceID, dstID, fieldName string, fieldType domain.FieldType, fieldProperty domain.FieldProperty) (*domain.TableField, error)
	DeleteField(ctx context.Context, spaceID, dstID, fieldID string) error
	UpdateFieldIndex(ctx context.Context, dstID, viewID, fieldID string, index int) error
}

func NewServer(tableService TableService, allowOrigins []string, port string, readTimeout time.Duration, wikiDataDir string) *Server {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()

	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	corsCfg := cors.Config{
		AllowMethods:  []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders: []string{"Content-Length"},
		MaxAge:        12 * time.Hour,
	}
	if len(allowOrigins) == 0 {
		corsCfg.AllowAllOrigins = true
	} else {
		corsCfg.AllowOrigins = allowOrigins
		corsCfg.AllowCredentials = true
	}
	router.Use(cors.New(corsCfg))

	server := &Server{
		router:       router,
		tableService: tableService,
		port:         port,
		wikiDataDir:  strings.TrimSpace(wikiDataDir),
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

	v1 := s.router.Group("/api/v1")
	RegisterHandlers(v1, s)

	if s.wikiDataDir != "" {
		if err := os.MkdirAll(s.wikiDataDir, 0o755); err != nil {
			slog.Error("wiki data dir", "path", s.wikiDataDir, "error", err)
		}
		v1.GET("/wiki/pages/:pageKey", s.getWikiPage)
		v1.PUT("/wiki/pages/:pageKey", s.putWikiPage)
	}
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

func (s *Server) handleError(c *gin.Context, err error) {
	slog.Error("Failed to proccess", "error", err)

	c.JSON(http.StatusInternalServerError, ErrorResponse{
		Code:    http.StatusInternalServerError,
		Message: "Internal server error",
	})
}
