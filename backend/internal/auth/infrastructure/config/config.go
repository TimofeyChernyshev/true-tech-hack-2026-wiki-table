package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	JWTAccessSecret  string        `env:"JWT_ACCESS_SECRET,required"`
	JWTRefreshSecret string        `env:"JWT_REFRESH_SECRET,required"`
	JWTAccessTTL     time.Duration `env:"JWT_ACCESS_TTL,required"`
	JWTRefreshTTL    time.Duration `env:"JWT_REFRESH_TTL,required"`

	AllowOrigins    []string      `env:"ALLOW_ORIGINS"`
	HTTPPort        string        `env:"AUTH_PORT" envDefault:"8082"`
	HTTPReadTimeout time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"15s"`

	DBUser     string `env:"DB_USER,required"`
	DBPassword string `env:"DB_PASSWORD,required"`
	DBHost     string `env:"DB_HOST,required"`
	DBPort     string `env:"DB_PORT,required"`
	DBName     string `env:"DB_NAME,required"`
	SSLMode    string `env:"SSLMODE" envDefault:"disable"`
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
