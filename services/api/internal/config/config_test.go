package config_test

import (
	"log/slog"
	"testing"

	"github.com/NIRASHA3/finintel/services/api/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("API_PORT", "")
	t.Setenv("API_HOST", "")
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DATABASE_MAX_CONNS", "")

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
		Env:             "production",
		Port:            8080,
		DatabaseURL:     "postgres://finintel_user:placeholder_pass@localhost:5432/finintel_dev?sslmode=disable",
		OIDCIssuerURL:   "https://auth.example.com",
		OIDCAudience:    "finintel-api",
		OIDCAllowedAlgs: []string{"RS256"},
	}

	err := cfg.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "placeholder")
}

func TestValidateProductionSuccess(t *testing.T) {
	cfg := &config.Config{
		Env:             "production",
		Port:            8080,
		DatabaseURL:     "postgres://real_prod_user:secret_prod_pass@prod-db.example.com:5432/finintel_prod?sslmode=require",
		OIDCIssuerURL:   "https://auth.example.com",
		OIDCJwksURL:     "https://auth.example.com/.well-known/jwks.json",
		OIDCAudience:    "finintel-api",
		OIDCAllowedAlgs: []string{"RS256"},
	}

	err := cfg.Validate()
	assert.NoError(t, err)
}

func TestValidateInsecureJWKSURLRejectedInStagingAndProduction(t *testing.T) {
	for _, env := range []string{"production", "staging"} {
		cfg := &config.Config{
			Env:             env,
			Port:            8080,
			DatabaseURL:     "postgres://real_user:secret_pass@db.example.com:5432/finintel?sslmode=require",
			OIDCIssuerURL:   "https://auth.example.com",
			OIDCJwksURL:     "http://auth.example.com/.well-known/jwks.json",
			OIDCAudience:    "finintel-api",
			OIDCAllowedAlgs: []string{"RS256"},
		}

		err := cfg.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "OIDC_JWKS_URL must use HTTPS")
	}
}

func TestValidateOIDCAllowedAlgs(t *testing.T) {
	cfg := &config.Config{
		Env:           "development",
		Port:          8080,
		DatabaseURL:   "postgres://localhost:5432/db",
		OIDCIssuerURL: "http://localhost:8081/realms/finintel",
		OIDCAudience:  "finintel-api",
	}

	// Empty algorithms rejected
	cfg.OIDCAllowedAlgs = []string{}
	err := cfg.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "OIDC_ALLOWED_ALGS must contain at least one algorithm")

	// Unsupported algorithm rejected
	cfg.OIDCAllowedAlgs = []string{"HS256"}
	err = cfg.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "only RS256 is allowed")

	// RS256 accepted
	cfg.OIDCAllowedAlgs = []string{"RS256"}
	err = cfg.Validate()
	assert.NoError(t, err)
}
