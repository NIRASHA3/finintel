package http

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NIRASHA3/finintel/services/api/internal/config"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/account"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/ledger"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/organization"
	customMiddleware "github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

func NewRouter(db PingerProvider, logger *slog.Logger) http.Handler {
	defaultCfg := &config.Config{
		CorsAllowedOrigins: []string{"http://localhost:3000"},
		AuthDevMode:        true,
	}
	return NewRouterWithConfig(db, logger, defaultCfg)
}

func NewRouterWithConfig(db PingerProvider, logger *slog.Logger, cfg *config.Config) http.Handler {
	r := chi.NewRouter()

	allowedOrigins := []string{"http://localhost:3000"}
	devMode := true
	if cfg != nil {
		if len(cfg.CorsAllowedOrigins) > 0 {
			allowedOrigins = cfg.CorsAllowedOrigins
		}
		devMode = cfg.AuthDevMode
	}

	// Middleware pipeline:
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(customMiddleware.CORS(allowedOrigins))
	r.Use(SlogLoggerMiddleware(logger))
	r.Use(middleware.Timeout(60 * time.Second))

	healthHandler := NewHealthHandler(db)

	r.Route("/health", func(r chi.Router) {
		r.Get("/live", healthHandler.Live)
		r.Get("/ready", healthHandler.Ready)
	})

	var pool *pgxpool.Pool
	if p, ok := db.(interface{ Pool() *pgxpool.Pool }); ok && p != nil {
		pool = p.Pool()
	} else if p, ok := db.(*pgxpool.Pool); ok {
		pool = p
	}

	orgService := organization.NewService(pool)
	accService := account.NewService(pool)
	ledgerService := ledger.NewService(pool)

	userHandler := NewUserHandler()
	orgHandler := NewOrganizationHandler(orgService)
	accHandler := NewAccountHandler(accService)
	ledgerHandler := NewLedgerHandler(ledgerService)

	// API v1 Protected Routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(customMiddleware.RequireAuth(pool, devMode))

		r.Get("/users/me", userHandler.GetCurrentUser)

		r.Route("/organizations", func(r chi.Router) {
			r.Post("/", orgHandler.CreateOrganization)
			r.Get("/", orgHandler.ListOrganizations)
			r.Get("/{organizationId}", orgHandler.GetOrganization)

			// Organization-scoped Account routes
			r.Route("/{organizationId}/accounts", func(r chi.Router) {
				r.Get("/", accHandler.ListAccounts)
				r.Post("/", accHandler.CreateAccount)
				r.Post("/seed", accHandler.SeedDefaultAccounts)
			})

			// Organization-scoped Ledger routes
			r.Route("/{organizationId}/journal-entries", func(r chi.Router) {
				r.Get("/", ledgerHandler.ListJournalEntries)
				r.Post("/", ledgerHandler.PostJournalEntry)
				r.Get("/{entryId}", ledgerHandler.GetJournalEntry)
			})
		})
	})

	return r
}

func SlogLoggerMiddleware(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			t1 := time.Now()

			defer func() {
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
