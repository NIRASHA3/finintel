package http

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NIRASHA3/finintel/services/api/internal/config"
)

type mockPinger struct{}

func (m *mockPinger) Ping(ctx context.Context) error {
	return nil
}

func TestRouter_Track1RoutesRegistration(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg := &config.Config{
		Env:           "development",
		OIDCIssuerURL: "https://auth.finintel.internal",
		OIDCAudience:  "finintel-api",
		OIDCJwksURL:   "https://auth.finintel.internal/.well-known/jwks.json",
	}

	routerHandler := NewRouterWithConfig(&mockPinger{}, logger, cfg)
	chiRouter, ok := routerHandler.(chi.Router)
	require.True(t, ok, "Router must implement chi.Router")

	routesMap := make(map[string]bool)
	walkFunc := func(method string, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		cleanRoute := strings.TrimSuffix(route, "/*")
		cleanRoute = strings.TrimSuffix(cleanRoute, "/")
		if cleanRoute == "" {
			cleanRoute = "/"
		}
		routesMap[method+" "+cleanRoute] = true
		return nil
	}

	err := chi.Walk(chiRouter, walkFunc)
	require.NoError(t, err)

	expectedRoutes := []struct {
		method string
		path   string
	}{
		{"GET", "/health/live"},
		{"GET", "/health/ready"},
		{"GET", "/api/v1/users/me"},
		{"GET", "/api/v1/organizations"},
		{"POST", "/api/v1/organizations"},
		{"GET", "/api/v1/organizations/{organizationId}"},
		{"GET", "/api/v1/organizations/{organizationId}/members"},
		{"POST", "/api/v1/organizations/{organizationId}/members"},
		{"PUT", "/api/v1/organizations/{organizationId}/members/{memberId}/role"},
		{"DELETE", "/api/v1/organizations/{organizationId}/members/{memberId}"},
		{"GET", "/api/v1/organizations/{organizationId}/accounts"},
		{"POST", "/api/v1/organizations/{organizationId}/accounts"},
		{"POST", "/api/v1/organizations/{organizationId}/accounts/seed"},
		{"GET", "/api/v1/organizations/{organizationId}/journal-entries"},
		{"POST", "/api/v1/organizations/{organizationId}/journal-entries"},
		{"GET", "/api/v1/organizations/{organizationId}/journal-entries/{entryId}"},
		{"POST", "/api/v1/organizations/{organizationId}/journal-entries/{entryId}/reverse"},
		{"GET", "/api/v1/organizations/{organizationId}/staged-transactions"},
		{"POST", "/api/v1/organizations/{organizationId}/staged-transactions/upload"},
		{"POST", "/api/v1/organizations/{organizationId}/staged-transactions/{id}/approve"},
		{"POST", "/api/v1/organizations/{organizationId}/staged-transactions/{id}/reject"},
		{"POST", "/api/v1/organizations/{organizationId}/staged-transactions/batch-post"},
		{"GET", "/api/v1/organizations/{organizationId}/fiscal-periods"},
		{"POST", "/api/v1/organizations/{organizationId}/fiscal-periods/generate"},
		{"POST", "/api/v1/organizations/{organizationId}/fiscal-periods/{periodId}/close"},
		{"POST", "/api/v1/organizations/{organizationId}/fiscal-periods/{periodId}/lock"},
		{"POST", "/api/v1/organizations/{organizationId}/fiscal-periods/{periodId}/unlock"},
		{"GET", "/api/v1/organizations/{organizationId}/reports/income-statement"},
		{"GET", "/api/v1/organizations/{organizationId}/reports/balance-sheet"},
		{"GET", "/api/v1/organizations/{organizationId}/reports/trial-balance"},
		{"GET", "/api/v1/organizations/{organizationId}/export/ledger"},
		{"GET", "/api/v1/organizations/{organizationId}/export/audit"},
		{"GET", "/api/v1/organizations/{organizationId}/audit-logs"},
		{"GET", "/api/v1/organizations/{organizationId}/dashboard/metrics"},
		{"GET", "/api/v1/organizations/{organizationId}/anomalies"},
		{"POST", "/api/v1/organizations/{organizationId}/reconciliations/match"},
		{"GET", "/api/v1/organizations/{organizationId}/webhooks/subscriptions"},
		{"POST", "/api/v1/organizations/{organizationId}/webhooks/subscriptions"},
		{"DELETE", "/api/v1/organizations/{organizationId}/webhooks/subscriptions/{id}"},
		{"GET", "/api/v1/organizations/{organizationId}/fx-rates"},
		{"POST", "/api/v1/organizations/{organizationId}/fx-rates"},
		{"POST", "/api/v1/organizations/{organizationId}/fx-rates/revalue"},
	}

	for _, er := range expectedRoutes {
		key := er.method + " " + er.path
		assert.True(t, routesMap[key], "Route %s must be registered in Chi router", key)
	}
}
