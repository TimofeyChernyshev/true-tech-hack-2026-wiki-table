package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	TableServiceBaseURL        string        `env:"TABLE_SERVICE_BASE_URL,required"`
	TableServiceRequestTimeout time.Duration `env:"TABLE_SERVICE_REQUEST_TIMEOUT" envDefault:"60s"`
	Port                       string        `env:"WIKI_PAGE_PORT,required" envDefault:"8081"`
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
