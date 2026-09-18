package http_test

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NIRASHA3/finintel/services/api/internal/config"
	customHttp "github.com/NIRASHA3/finintel/services/api/internal/transport/http"
)

type dummyPinger struct{}

func (d *dummyPinger) Ping(ctx context.Context) error { return nil }

func TestRouteParity_Bidirectional_OpenAPI_GoRouter(t *testing.T) {
	cfg := &config.Config{
		Env:           "development",
		OIDCIssuerURL: "https://auth.example.com",
		OIDCAudience:  "finintel-api",
		OIDCJwksURL:   "https://auth.example.com/.well-known/jwks.json",
	}

	handler := customHttp.NewRouterWithConfig(&dummyPinger{}, slog.Default(), cfg)
	chiRouter, ok := handler.(chi.Router)
	require.True(t, ok, "Router must implement chi.Router")

	routerRoutes := make(map[string]bool)

	var walkFunc chi.WalkFunc = func(method string, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		cleanRoute := strings.TrimSuffix(route, "/*")
		cleanRoute = strings.TrimSuffix(cleanRoute, "/")
		if strings.HasPrefix(cleanRoute, "/api/v1") {
			routerRoutes[method+" "+cleanRoute] = true
		}
		return nil
	}

	err := chi.Walk(chiRouter, walkFunc)
	require.NoError(t, err)

	openapiPath := "../../../../contracts/openapi/openapi.yaml"
	data, err := os.ReadFile(openapiPath)
	if err != nil {
		openapiPath = "../../../../../contracts/openapi/openapi.yaml"
		data, err = os.ReadFile(openapiPath)
	}
	require.NoError(t, err, "Must be able to locate and read openapi.yaml")

	content := string(data)

	// Extract path blocks and methods from OpenAPI YAML
	pathBlockRegex := regexp.MustCompile(`(?m)^\s\s(/api/v1/[^\s:]+):\s*\n((?:\s\s\s\s[^\n]+\n)+)`)
	matches := pathBlockRegex.FindAllStringSubmatch(content, -1)

	openapiEndpoints := make(map[string]bool)
	methodRegex := regexp.MustCompile(`(?m)^\s\s\s\s(get|post|put|delete|patch):`)

	for _, m := range matches {
		path := strings.TrimSuffix(m[1], "/")
		block := m[2]

		methodMatches := methodRegex.FindAllStringSubmatch(block, -1)
		for _, mm := range methodMatches {
			method := strings.ToUpper(mm[1])
			openapiEndpoints[method+" "+path] = true
		}
	}

	assert.NotEmpty(t, openapiEndpoints, "OpenAPI spec must define /api/v1/ endpoints")

	normalize := func(s string) string {
		s = strings.TrimSuffix(s, "/")
		return regexp.MustCompile(`\{[^}]+\}`).ReplaceAllString(s, "{param}")
	}

	// 1. Forward check: OpenAPI -> Go Router
	for openapiEndpoint := range openapiEndpoints {
		normalizedOpenAPI := normalize(openapiEndpoint)

		found := false
		for routerRoute := range routerRoutes {
			normalizedRouter := normalize(routerRoute)
			if normalizedOpenAPI == normalizedRouter {
				found = true
				break
			}
		}
		assert.True(t, found, "OpenAPI endpoint '%s' must exist in Go Chi Router", openapiEndpoint)
	}

	// 2. Reverse check: Go Router -> OpenAPI
	for routerRoute := range routerRoutes {
		normalizedRouter := normalize(routerRoute)

		found := false
		for openapiEndpoint := range openapiEndpoints {
			normalizedOpenAPI := normalize(openapiEndpoint)
			if normalizedRouter == normalizedOpenAPI {
				found = true
				break
			}
		}
		assert.True(t, found, "Go Chi Router route '%s' must be documented in OpenAPI spec", routerRoute)
	}
}
