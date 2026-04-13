package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	MWSTablesBaseURL  string        `env:"MWS_TABLES_BASE_URL,required"`
	MWSAPIKey         string        `env:"MWS_API_KEY,required"`
	MWSRequestTimeout time.Duration `env:"MWS_TABLES_REQUEST_TIMEOUT" envDefault:"60s"`
	AllowOrigins      []string      `env:"ALLOW_ORIGINS"`
	HTTPPort          string        `env:"HTTP_PORT" envDefault:"8080"`
	HTTPReadTimeout   time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"15s"`
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	var cfg Config

	err := env.Parse(&cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	return &cfg, nil
}
