package authhttp

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/domain"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Server struct {
	router      *gin.Engine
	httpServer  *http.Server
	authService AuthService
	port        string
	accessTTL   time.Duration
	refreshTTL  time.Duration
}

type AuthService interface {
	Register(ctx context.Context, email, password, name string) (*domain.User, *domain.TokenPair, error)
	Login(ctx context.Context, email, password string) (*domain.User, *domain.TokenPair, error)
	Logout(ctx context.Context, token string) error
	Refresh(ctx context.Context, refreshToken string) (*domain.TokenPair, error)
	GetMe(ctx context.Context, userID string) (*domain.User, error)
	ListUsers(ctx context.Context) ([]*domain.User, error)
	UpdateUserRole(ctx context.Context, userID string, role domain.Role) error
	CheckPermission(ctx context.Context, userID, resource, action string) (bool, error)
	ValidateToken(ctx context.Context, token string) (*domain.TokenClaims, error)
}

func NewServer(authService AuthService, allowOrigins []string, port string, readTimeout, accessTTL, refreshTTL time.Duration) *Server {
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
		router:      router,
		authService: authService,
		port:        port,
		accessTTL:   accessTTL,
		refreshTTL:  refreshTTL,
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
