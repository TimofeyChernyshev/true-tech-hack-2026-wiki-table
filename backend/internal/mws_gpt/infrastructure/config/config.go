package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	HTTPPort        string        `env:"GPT_PORT" envDefault:"8084"`
	HTTPReadTimeout time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"30s"`
	AllowOrigins    []string      `env:"ALLOW_ORIGINS"`

	// MWS GPT API
	MWSGPTBaseURL  string        `env:"MWS_GPT_BASE_URL,required"`
	MWSGPTAPIKey   string        `env:"MWS_GPT_API_KEY,required"`
	RequestTimeout time.Duration `env:"MWS_GPT_REQUEST_TIMEOUT" envDefault:"60s"`
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
