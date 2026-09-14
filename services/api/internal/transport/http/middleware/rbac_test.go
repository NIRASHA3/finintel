package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRequireRole(t *testing.T) {
	mw := RequireRole("ADMINISTRATOR", "OWNER")
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})
	handler := mw(nextHandler)

	t.Run("Missing role context returns 403", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("Allowed role OWNER permits access", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		ctx := context.WithValue(req.Context(), RoleContextKey, "OWNER")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req.WithContext(ctx))
		assert.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("Disallowed role VIEWER returns 403", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		ctx := context.WithValue(req.Context(), RoleContextKey, "VIEWER")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req.WithContext(ctx))
		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}
