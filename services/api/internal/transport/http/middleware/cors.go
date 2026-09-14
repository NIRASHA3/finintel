package middleware

import (
	"net/http"
	"strings"
)

// CORS returns a middleware handler that manages Cross-Origin Resource Sharing headers.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	originsMap := make(map[string]bool)
	for _, origin := range allowedOrigins {
		originsMap[strings.TrimSpace(origin)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Private server-to-server backend API: Direct browser CORS is disabled.
			// Next.js BFF acts as the sole browser-facing origin.
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Idempotency-Key, X-Correlation-ID")
			w.Header().Set("Access-Control-Max-Age", "86400")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
