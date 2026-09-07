package middleware

import (
	"context"
	"net/http"
	"strings"
)

const RoleContextKey contextKey = "user_role"

func RBACContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role == "" {
			role = "Admin" // Default to Admin for backwards compatibility
		}
		ctx := context.WithValue(r.Context(), RoleContextKey, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value(RoleContextKey).(string)
			if !ok || userRole == "" {
				userRole = "Admin"
			}

			// Admin role always bypasses checks
			if strings.EqualFold(userRole, "Admin") {
				next.ServeHTTP(w, r)
				return
			}

			allowed := false
			for _, role := range allowedRoles {
				if strings.EqualFold(userRole, role) {
					allowed = true
					break
				}
			}

			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte(`{"error":"access_denied","message":"your assigned role ('` + userRole + `') does not have permission to execute this operation"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
