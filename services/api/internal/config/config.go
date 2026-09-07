package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Env                string
	Port               int
	Host               string
	LogLevel           string
	DatabaseURL        string
	DatabaseMaxConns   int32
	CorsAllowedOrigins []string
	OIDCProviderURL    string
	OIDCAudience       string
	OIDCJwksURL        string
	AuthDevMode        bool
}

func Load() (*Config, error) {
	loadDotEnv(".env", "../.env", "../../.env", "services/api/.env")

	env := getEnv("APP_ENV", "development")

	portStr := getEnv("API_PORT", "8080")
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, fmt.Errorf("invalid API_PORT value '%s': %w", portStr, err)
	}

	host := getEnv("API_HOST", "0.0.0.0")
	logLevel := getEnv("LOG_LEVEL", "info")
	dbURL := getEnv("DATABASE_URL", "postgres://finintel_user:placeholder_pass@localhost:5432/finintel_dev?sslmode=disable")

	maxConnsStr := getEnv("DATABASE_MAX_CONNS", "25")
	maxConns, err := strconv.ParseInt(maxConnsStr, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid DATABASE_MAX_CONNS value '%s': %w", maxConnsStr, err)
	}

	corsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
	var corsOrigins []string
	for _, origin := range strings.Split(corsRaw, ",") {
		if trimmed := strings.TrimSpace(origin); trimmed != "" {
			corsOrigins = append(corsOrigins, trimmed)
		}
	}

	oidcProvider := getEnv("OIDC_ISSUER_URL", "http://localhost:8081/realms/finintel")
	oidcAudience := getEnv("OIDC_AUDIENCE", "finintel-api")
	oidcJwksURL := getEnv("OIDC_JWKS_URL", "http://localhost:8081/realms/finintel/protocol/openid-connect/certs")
	authDevModeStr := getEnv("AUTH_DEV_MODE", "true")
	authDevMode := strings.ToLower(authDevModeStr) == "true" || env == "development"

	cfg := &Config{
		Env:                env,
		Port:               port,
		Host:               host,
		LogLevel:           logLevel,
		DatabaseURL:        dbURL,
		DatabaseMaxConns:   int32(maxConns),
		CorsAllowedOrigins: corsOrigins,
		OIDCProviderURL:    oidcProvider,
		OIDCAudience:       oidcAudience,
		OIDCJwksURL:        oidcJwksURL,
		AuthDevMode:        authDevMode,
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.Env == "production" || c.Env == "staging" {
		if c.DatabaseURL == "" || strings.Contains(c.DatabaseURL, "placeholder_pass") {
			return fmt.Errorf("DATABASE_URL must be explicitly configured with production credentials in %s environment", c.Env)
		}
	}
	if c.Port <= 0 || c.Port > 65535 {
		return fmt.Errorf("invalid port number: %d", c.Port)
	}
	return nil
}

func (c *Config) SlogLevel() slog.Level {
	switch strings.ToLower(c.LogLevel) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func loadDotEnv(paths ...string) {
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, `"'`)
				if _, exists := os.LookupEnv(key); !exists || os.Getenv(key) == "" {
					_ = os.Setenv(key, val)
				}
			}
		}
	}
}
