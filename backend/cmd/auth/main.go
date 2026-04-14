package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/application"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/config"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/jwt"
	authhttp "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/receiver/http"
	postgresrepository "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/infrastructure/repository/postgres"

	"github.com/golang-migrate/migrate/v4"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	setLogger()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("cannot load config", "error", err)
		os.Exit(1)
	}

	userRepo, err := postgresrepository.NewPostgresUserRepository(fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.SSLMode,
	))
	if err != nil {
		slog.Error("cannot start postgres", "error", err)
		os.Exit(1)
	}

	tokenMgr := jwt.NewTokenManager(
		cfg.JWTAccessSecret,
		cfg.JWTRefreshSecret,
		cfg.JWTAccessTTL,
		cfg.JWTRefreshTTL,
	)

	authService := application.NewAuthService(userRepo, tokenMgr)

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

func runMigrations(cfg *config.Config) error {
	connString := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.SSLMode,
	)

	m, err := migrate.New(
		"file://migrations",
		connString,
	)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}
	defer func() {
		_, _ = m.Close()
	}()

	if err = m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}
