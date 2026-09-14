package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/NIRASHA3/finintel/services/api/internal/platform/oidc"
)

type contextKey string

const UserClaimsContextKey contextKey = "authenticatedUserClaims"

// RequireAuth extracts and cryptographically verifies the OIDC Bearer token.
func RequireAuth(validator *oidc.Validator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing or malformed Authorization header")
				return
			}

			tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
			if tokenStr == "" {
				writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Empty bearer token")
				return
			}

			claims, err := validator.ValidateToken(tokenStr)
			if err != nil {
				if errors.Is(err, oidc.ErrInfraFailure) {
					writeJSONError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Identity provider infrastructure unavailable")
					return
				}
				writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), UserClaimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetClaimsFromContext retrieves the authenticated OIDC claims from context.
func GetClaimsFromContext(ctx context.Context) (*oidc.Claims, bool) {
	claims, ok := ctx.Value(UserClaimsContextKey).(*oidc.Claims)
	return claims, ok
}

func writeJSONError(w http.ResponseWriter, statusCode int, errType, message string) {
	w.Header().Set("Content-Type", "application/json")
	if statusCode == http.StatusUnauthorized {
		w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
	}
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   errType,
		"message": message,
	})
}
