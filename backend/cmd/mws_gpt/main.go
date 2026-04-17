package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/application"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/infrastructure/config"
	mwsgptclient "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/infrastructure/mws_gpt_client"
	mwsgpthttp "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/infrastructure/receiver/http"
)

func main() {
	setLogger()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("cannot load config", "error", err)
	}

	slog.Info("Starting MWS GPT Service", "port", cfg.HTTPPort, "gpt_url", cfg.MWSGPTBaseURL)

	gptClientWrapper, err := mwsgptclient.NewClientWrapper(
		cfg.MWSGPTBaseURL,
		cfg.MWSGPTAPIKey,
		cfg.RequestTimeout,
	)
	if err != nil {
		slog.Error("Failed to create GPT client", "error", err)
		os.Exit(1)
	}

	gptService := application.NewGPTService(gptClientWrapper)

	server := mwsgpthttp.NewServer(
		gptService,
		cfg.AllowOrigins,
		cfg.HTTPPort,
		cfg.HTTPReadTimeout,
	)

	serverErr := make(chan error, 1)
	go func() {
		if err := server.Start(); err != nil {
			serverErr <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		slog.Error("Server error", "error", err)
		os.Exit(1)
	case sig := <-quit:
		slog.Info("Shutdown signal received", "signal", sig.String())
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("Server stopped gracefully")
}

func setLogger() {
	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	logger := slog.New(handler)
	slog.SetDefault(logger)
}
