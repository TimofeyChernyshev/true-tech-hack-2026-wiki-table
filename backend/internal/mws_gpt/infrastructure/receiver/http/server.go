package mwsgpthttp

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/domain"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type GPTService interface {
	Chat(ctx context.Context, req domain.ChatRequest) (*domain.ChatResponse, error)
	ChatStream(ctx context.Context, req domain.ChatRequest) (<-chan string, error)

	Generate(ctx context.Context, req domain.GenerateRequest) (*domain.GenerateResponse, error)

	GetEmbeddings(ctx context.Context, req domain.EmbeddingsRequest) (*domain.EmbeddingsResponse, error)

	GetModels(ctx context.Context) ([]ModelInfo, error)
}

type Server struct {
	router     *gin.Engine
	httpServer *http.Server
	gptService GPTService
	port       string
}

func NewServer(gptService GPTService, allowOrigins []string, port string, readTimeout time.Duration) *Server {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	corsCfg := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	if len(allowOrigins) == 0 {
		corsCfg.AllowAllOrigins = true
	} else {
		corsCfg.AllowOrigins = allowOrigins
	}

	router.Use(cors.New(corsCfg))

	server := &Server{
		router:     router,
		gptService: gptService,
		port:       port,
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
	s.router.GET("/health", s.healthCheck)
	s.router.HEAD("/health", s.healthCheck)

	v1 := s.router.Group("/api/v1")
	RegisterHandlers(v1, s)
}

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Unix(),
	})
}

func (s *Server) Start() error {
	slog.Info("Starting GPT Service", "port", s.port)
	if err := s.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server error: %w", err)
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	slog.Info("Shutting down GPT Service")
	return s.httpServer.Shutdown(ctx)
}
