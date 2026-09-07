package http

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

type mockPinger struct{}

func (m *mockPinger) Ping(ctx context.Context) error {
	return nil
}

func TestRouter_Phase6RoutesRegistration(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	router := NewRouter(&mockPinger{}, logger)

	testCases := []struct {
		name           string
		method         string
		path           string
		expectedNot404 bool
	}{
		{
			name:           "Get Executive Dashboard Metrics Endpoint",
			method:         "GET",
			path:           "/api/v1/organizations/00000000-0000-0000-0000-000000000001/dashboard/metrics",
			expectedNot404: true,
		},
		{
			name:           "Get Anomalies Endpoint",
			method:         "GET",
			path:           "/api/v1/organizations/00000000-0000-0000-0000-000000000001/anomalies",
			expectedNot404: true,
		},
		{
			name:           "Export Ledger CSV Endpoint",
			method:         "GET",
			path:           "/api/v1/organizations/00000000-0000-0000-0000-000000000001/export/ledger",
			expectedNot404: true,
		},
		{
			name:           "Get Audit Logs Endpoint",
			method:         "GET",
			path:           "/api/v1/organizations/00000000-0000-0000-0000-000000000001/audit-logs",
			expectedNot404: true,
		},
		{
			name:           "Get Organization Details Endpoint",
			method:         "GET",
			path:           "/api/v1/organizations/00000000-0000-0000-0000-000000000001",
			expectedNot404: true,
		},
		{
			name:           "Reconciliation AutoMatch Endpoint",
			method:         "POST",
			path:           "/api/v1/reconciliations/match",
			expectedNot404: true,
		},
		{
			name:           "Webhook Subscriptions List Endpoint",
			method:         "GET",
			path:           "/api/v1/webhooks/subscriptions",
			expectedNot404: true,
		},
		{
			name:           "FX Rates List Endpoint",
			method:         "GET",
			path:           "/api/v1/fx-rates",
			expectedNot404: true,
		},
		{
			name:           "Organization Members List Endpoint",
			method:         "GET",
			path:           "/api/v1/organizations/00000000-0000-0000-0000-000000000001/members",
			expectedNot404: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.Header.Set("Authorization", "Bearer dev-token-admin@finintel.io")
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			// Route must match and NOT return 404 Not Found
			assert.NotEqual(t, http.StatusNotFound, rec.Code, "Route %s %s returned 404 Not Found", tc.method, tc.path)
		})
	}
}
