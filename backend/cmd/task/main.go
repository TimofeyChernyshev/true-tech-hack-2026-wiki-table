package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/application"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/infrastructure/config"
	mwsclient "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/infrastructure/mws_client"
	tableshttp "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/infrastructure/receiver/http"
)

func main() {
	setLogger()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("cannot load config", "error", err)
		os.Exit(1)
	}

	mwsClient, err := mwsclient.NewClientWrapper(cfg.MWSTablesBaseURL, cfg.MWSAPIKey, cfg.MWSRequestTimeout)
	if err != nil {
		slog.Error("cannot create MWS client", "error", err)
		os.Exit(1)
	}

	tableService := application.NewTableService(mwsClient)

	server := tableshttp.NewServer(tableService, cfg.AllowOrigins, cfg.HTTPPort, cfg.HTTPReadTimeout, cfg.WikiDataDir)
	serverErr := make(chan error, 1)
	go func() {
		slog.Info("starting HTTP server", "port", cfg.HTTPPort)
		if err = server.Start(); err != nil {
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
}

func setLogger() {
	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	logger := slog.New(handler)
	slog.SetDefault(logger)
}
