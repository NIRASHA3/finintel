package http

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter(db PingerProvider, logger *slog.Logger) http.Handler {
	r := chi.NewRouter()

	// Middleware pipeline execution order:
	// 1. RequestID: Attach/propagate request correlation ID
	// 2. Recoverer: Catch panics in downstream handlers/middlewares
	// 3. Structured Logger: Log request method, path, status, latency, request ID (no sensitive data)
	// 4. Timeout: Apply 60s request context execution deadline
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(SlogLoggerMiddleware(logger))
	r.Use(middleware.Timeout(60 * time.Second))

	healthHandler := NewHealthHandler(db)

	r.Route("/health", func(r chi.Router) {
		r.Get("/live", healthHandler.Live)
		r.Get("/ready", healthHandler.Ready)
	})

	return r
}

func SlogLoggerMiddleware(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			t1 := time.Now()

			defer func() {
				// Logs ONLY sanitized metadata (no request bodies, authorization tokens, passwords, or raw query parameters)
				logger.Info("http_request",
					slog.String("request_id", middleware.GetReqID(r.Context())),
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.Int("status", ww.Status()),
					slog.Int("bytes", ww.BytesWritten()),
					slog.Duration("latency", time.Since(t1)),
				)
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
