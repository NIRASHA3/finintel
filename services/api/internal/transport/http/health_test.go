package http_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	transportHTTP "github.com/NIRASHA3/finintel/services/api/internal/transport/http"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockPinger struct {
	err error
}

func (m *mockPinger) Ping(ctx context.Context) error {
	return m.err
}

func TestHealthLive(t *testing.T) {
	handler := transportHTTP.NewHealthHandler(nil)
	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	rec := httptest.NewRecorder()

	handler.Live(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))

	var resp transportHTTP.LiveResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "UP", resp.Status)
}

func TestHealthReadySuccess(t *testing.T) {
	pinger := &mockPinger{err: nil}
	handler := transportHTTP.NewHealthHandler(pinger)
	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	rec := httptest.NewRecorder()

	handler.Ready(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))

	var resp transportHTTP.ReadyResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "UP", resp.Status)
	assert.Equal(t, "UP", resp.Checks["database"])
}

func TestHealthReadyFailure(t *testing.T) {
	pinger := &mockPinger{err: fmt.Errorf("connection refused")}
	handler := transportHTTP.NewHealthHandler(pinger)
	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	rec := httptest.NewRecorder()

	handler.Ready(rec, req)

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))

	var resp transportHTTP.ReadyResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "DOWN", resp.Status)
	assert.Equal(t, "DOWN", resp.Checks["database"])
	// Assert no sensitive connection strings or internal errors are exposed in response
	assert.NotContains(t, rec.Body.String(), "connection refused")
}
