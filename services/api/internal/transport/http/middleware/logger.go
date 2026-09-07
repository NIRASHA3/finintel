package middleware

import (
	"log/slog"
	"net/http"
	"time"

	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

// SlogLogger returns a middleware that logs structured HTTP request telemetry using slog.
func SlogLogger(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if logger == nil {
				logger = slog.Default()
			}
			ww := chiMiddleware.NewWrapResponseWriter(w, r.ProtoMajor)
			t1 := time.Now()

			defer func() {
				reqID := chiMiddleware.GetReqID(r.Context())
				logger.Info("http_request",
					slog.String("request_id", reqID),
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.Int("status", ww.Status()),
					slog.Int("bytes", ww.BytesWritten()),
					slog.Int64("latency_ms", time.Since(t1).Milliseconds()),
					slog.Duration("latency", time.Since(t1)),
				)
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
