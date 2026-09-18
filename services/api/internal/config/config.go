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
	OIDCIssuerURL      string
	OIDCAudience       string
	OIDCJwksURL        string
	OIDCAllowedAlgs    []string
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
	dbURL := getEnv("DATABASE_URL", "postgres://finintel_app_login:placeholder_pass@localhost:5432/finintel?sslmode=disable")

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

	oidcIssuer := getEnv("OIDC_ISSUER_URL", "http://localhost:8081/realms/finintel")
	oidcAudience := getEnv("OIDC_AUDIENCE", "finintel-api")
	oidcJwksURL := getEnv("OIDC_JWKS_URL", "")
	oidcAlgsRaw := getEnv("OIDC_ALLOWED_ALGS", "RS256")
	var oidcAllowedAlgs []string
	for _, alg := range strings.Split(oidcAlgsRaw, ",") {
		if trimmed := strings.TrimSpace(alg); trimmed != "" {
			oidcAllowedAlgs = append(oidcAllowedAlgs, trimmed)
		}
	}
	if len(oidcAllowedAlgs) == 0 {
		oidcAllowedAlgs = []string{"RS256"}
	}

	cfg := &Config{
		Env:                env,
		Port:               port,
		Host:               host,
		LogLevel:           logLevel,
		DatabaseURL:        dbURL,
		DatabaseMaxConns:   int32(maxConns),
		CorsAllowedOrigins: corsOrigins,
		OIDCIssuerURL:      oidcIssuer,
		OIDCAudience:       oidcAudience,
		OIDCJwksURL:        oidcJwksURL,
		OIDCAllowedAlgs:    oidcAllowedAlgs,
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.Port <= 0 || c.Port > 65535 {
		return fmt.Errorf("invalid port number: %d", c.Port)
	}
	if c.OIDCIssuerURL == "" {
		return fmt.Errorf("OIDC_ISSUER_URL must not be empty")
	}
	if c.OIDCAudience == "" {
		return fmt.Errorf("OIDC_AUDIENCE must not be empty")
	}

	// Validate allowed algorithms: RS256 is the only permitted algorithm unless explicitly approved
	if len(c.OIDCAllowedAlgs) == 0 {
		return fmt.Errorf("OIDC_ALLOWED_ALGS must contain at least one algorithm")
	}
	for _, alg := range c.OIDCAllowedAlgs {
		if alg != "RS256" {
			return fmt.Errorf("unsupported OIDC algorithm '%s': only RS256 is allowed", alg)
		}
	}

	if c.Env == "production" || c.Env == "staging" {
		if c.DatabaseURL == "" || strings.Contains(c.DatabaseURL, "placeholder_pass") || strings.Contains(c.DatabaseURL, "localhost") {
			return fmt.Errorf("DATABASE_URL contains default/placeholder values unacceptable in %s environment", c.Env)
		}
		if !strings.HasPrefix(c.OIDCIssuerURL, "https://") {
			return fmt.Errorf("OIDC_ISSUER_URL must use HTTPS in %s environment", c.Env)
		}
		if c.OIDCJwksURL != "" && !strings.HasPrefix(c.OIDCJwksURL, "https://") {
			return fmt.Errorf("OIDC_JWKS_URL must use HTTPS in %s environment", c.Env)
		}
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
