package middleware

import (
	"encoding/json"
	"net/http"
	"strings"
)

// RequireRole checks that the database-derived role attached to request context matches one of allowedRoles.
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value(RoleContextKey).(string)
			if !ok || userRole == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":   "FORBIDDEN",
					"message": "Missing organization role context",
				})
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
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":   "FORBIDDEN",
					"message": "Assigned role '" + userRole + "' does not have permission to execute this operation",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
