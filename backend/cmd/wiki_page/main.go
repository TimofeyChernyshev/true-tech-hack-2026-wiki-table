package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/application"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/infrastructure/config"
	tableclient "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/infrastructure/table_client"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/infrastructure/websocket"
)

func main() {
	setLogger()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("cannot load config", "error", err)
		os.Exit(1)
	}

	slog.Info("Starting WebSocket Service", "port", cfg.Port, "api", cfg.TableServiceBaseURL)

	apiClient, err := tableclient.NewClientWrapper(cfg.TableServiceBaseURL, cfg.TableServiceRequestTimeout)
	if err != nil {
		slog.Error("cannot create table client", "error", err)
		os.Exit(1)
	}

	wikiService := application.NewWikiService(apiClient)

	hub := websocket.NewHub(wikiService)
	defer hub.Shutdown()

	// HTTP сервер для WebSocket
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/ws", hub.HandleWebSocket)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	go func() {
		slog.Info("WebSocket server listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
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
