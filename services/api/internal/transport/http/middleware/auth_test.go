package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/NIRASHA3/finintel/services/api/internal/platform/oidc"
	"github.com/stretchr/testify/assert"
)

func TestRequireAuth_MissingHeader(t *testing.T) {
	validator := oidc.NewValidator(oidc.ValidatorConfig{
		IssuerURL: "https://auth.example.com",
		Audience:  "test-audience",
	})
	mw := RequireAuth(validator)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := mw(nextHandler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRequireAuth_InvalidToken(t *testing.T) {
	validator := oidc.NewValidator(oidc.ValidatorConfig{
		IssuerURL: "https://auth.example.com",
		Audience:  "test-audience",
	})
	mw := RequireAuth(validator)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := mw(nextHandler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer invalid.jwt.token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
