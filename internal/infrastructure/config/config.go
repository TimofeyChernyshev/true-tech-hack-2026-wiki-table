package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	HTTPListenAddr       string        `env:"HTTP_LISTEN_ADDR" envDefault:":8080"`
	MWSTablesBaseURL     string        `env:"MWS_TABLES_BASE_URL,required"`
	MWSAPIKey            string        `env:"MWS_API_KEY,required"`
	TablesRequestTimeout time.Duration `env:"MWS_TABLES_REQUEST_TIMEOUT" envDefault:"60s"`
}

func Load() (*Config, error) {
	var cfg Config

	err := env.Parse(&cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	return &cfg, nil
}
