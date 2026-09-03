package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRequireAuth_DevModeFallback(t *testing.T) {
	middleware := RequireAuth(nil, true)

	var retrievedUser UserContext
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := GetUserFromContext(r.Context())
		assert.True(t, ok)
		retrievedUser = u
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware(nextHandler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "dev-user@finintel.io", retrievedUser.Email)
	assert.Equal(t, "Development Admin", retrievedUser.FullName)
}

func TestRequireAuth_CustomDevToken(t *testing.T) {
	middleware := RequireAuth(nil, true)

	var retrievedUser UserContext
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := GetUserFromContext(r.Context())
		assert.True(t, ok)
		retrievedUser = u
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware(nextHandler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer dev-token-cfo@acme.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "cfo@acme.com", retrievedUser.Email)
}
