package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/application"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/config"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/jwt"
	authhttp "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/receiver/http"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/repository"
)

func main() {
	setLogger()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("cannot load config", "error", err)
		os.Exit(1)
	}

	userRepo := repository.NewInMemoryUserRepository()

	// Token менеджер
	tokenMgr := jwt.NewTokenManager(
		cfg.JWTAccessSecret,
		cfg.JWTRefreshSecret,
		cfg.JWTAccessTTL,
		cfg.JWTRefreshTTL,
	)

	// Сервис
	authService := application.NewAuthService(userRepo, tokenMgr)

	// HTTP сервер
	server := authhttp.NewServer(authService, cfg.AllowOrigins, cfg.HTTPPort, cfg.HTTPReadTimeout, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)

	go func() {
		if err := server.Start(); err != nil {
			slog.Error("Server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	server.Shutdown(shutdownCtx)
	slog.Info("Server stopped")
}

func setLogger() {
	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	logger := slog.New(handler)
	slog.SetDefault(logger)
}
