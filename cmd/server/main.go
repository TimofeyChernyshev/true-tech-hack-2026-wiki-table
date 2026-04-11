package main

import (
	"log"
	"net/http"

	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/httpapi"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/infrastructure/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	fusion, err := httpapi.NewFusionClient(cfg.MWSTablesBaseURL, cfg.MWSAPIKey, cfg.TablesRequestTimeout)
	if err != nil {
		log.Fatalf("fusion client: %v", err)
	}

	h := &httpapi.TableRecordsHandler{Fusion: fusion}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/tables/{dstId}/records", h.ServeGetTableRecords)

	addr := cfg.HTTPListenAddr
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, httpapi.WithCORS(mux)); err != nil {
		log.Fatalf("server: %v", err)
	}
}
