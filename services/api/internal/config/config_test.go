package config_test

import (
	"log/slog"
	"os"
	"testing"

	"github.com/NIRASHA3/finintel/services/api/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadDefaults(t *testing.T) {
	os.Unsetenv("APP_ENV")
	os.Unsetenv("API_PORT")
	os.Unsetenv("LOG_LEVEL")
	os.Unsetenv("DATABASE_URL")

	cfg, err := config.Load()
	require.NoError(t, err)
	assert.Equal(t, "development", cfg.Env)
	assert.Equal(t, 8080, cfg.Port)
	assert.Equal(t, "0.0.0.0", cfg.Host)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, slog.LevelInfo, cfg.SlogLevel())
}

func TestValidateProductionFailsWithPlaceholder(t *testing.T) {
	cfg := &config.Config{
		Env:         "production",
		Port:        8080,
		DatabaseURL: "postgres://finintel_user:placeholder_pass@localhost:5432/finintel_dev?sslmode=disable",
	}

	err := cfg.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "DATABASE_URL must be explicitly configured")
}

func TestValidateProductionSuccess(t *testing.T) {
	cfg := &config.Config{
		Env:         "production",
		Port:        8080,
		DatabaseURL: "postgres://real_prod_user:secret_prod_pass@prod-db.example.com:5432/finintel_prod?sslmode=require",
	}

	err := cfg.Validate()
	assert.NoError(t, err)
}
