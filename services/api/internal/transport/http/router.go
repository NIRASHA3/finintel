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
	"github.com/NIRASHA3/finintel/services/api/internal/domain/anomaly"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/audit"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/closing"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/dashboard"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/export"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/fx"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/ledger"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/organization"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/reconciliation"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/reports"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/reversal"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/staging"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/webhook"
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
	r.Use(customMiddleware.SlogLogger(logger))
	r.Use(customMiddleware.RateLimit(100, 200))
	r.Use(customMiddleware.RBACContextMiddleware)
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
	stagingService := staging.NewService(pool)
	reportsService := reports.NewService(pool)
	closingService := closing.NewService(pool)
	auditService := audit.NewService(pool)
	reversalService := reversal.NewService(pool)
	anomalyService := anomaly.NewService(pool)
	dashboardService := dashboard.NewService(pool)
	exportService := export.NewService(pool)
	recService := reconciliation.NewService(pool)
	webhookService := webhook.NewService(pool)
	fxService := fx.NewService(pool)

	userHandler := NewUserHandler()
	orgHandler := NewOrganizationHandler(orgService)
	accHandler := NewAccountHandler(accService)
	ledgerHandler := NewLedgerHandler(ledgerService)
	stagingHandler := NewStagingHandler(stagingService)
	reportsHandler := NewReportsHandler(reportsService)
	closingHandler := NewClosingHandler(closingService)
	auditHandler := NewAuditHandler(auditService)
	reversalHandler := NewReversalHandler(reversalService)
	anomalyHandler := NewAnomalyHandler(anomalyService)
	dashboardHandler := NewDashboardHandler(dashboardService)
	exportHandler := NewExportHandler(exportService)
	recHandler := NewReconciliationHandler(recService)
	webhookHandler := NewWebhookHandler(webhookService)
	fxHandler := NewFXHandler(fxService)
	memberHandler := NewMemberHandler()

	// API v1 Protected Routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(customMiddleware.RequireAuth(pool, devMode))

		r.Get("/users/me", userHandler.GetCurrentUser)

		// Bank Reconciliation routes
		r.Post("/reconciliations/match", recHandler.AutoMatch)

		// Webhook routes
		r.Route("/webhooks/subscriptions", func(r chi.Router) {
			r.Get("/", webhookHandler.ListSubscriptions)
			r.Post("/", webhookHandler.CreateSubscription)
			r.Delete("/{id}", webhookHandler.DeleteSubscription)
		})

		// Foreign Exchange Rate & Revaluation routes
		r.Route("/fx-rates", func(r chi.Router) {
			r.Get("/", fxHandler.ListRates)
			r.Post("/", fxHandler.UpsertRate)
			r.Post("/revalue", fxHandler.Revalue)
		})

		r.Route("/organizations", func(r chi.Router) {
			r.Post("/", orgHandler.CreateOrganization)
			r.Get("/", orgHandler.ListOrganizations)

			// Organization Members / Roles routes
			r.Route("/{id}/members", func(r chi.Router) {
				r.Get("/", memberHandler.ListMembers)
				r.Put("/{memberId}/role", memberHandler.UpdateMemberRole)
			})

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
				r.Post("/{entryId}/reverse", reversalHandler.PostReversalEntry)
			})

			// Organization-scoped Staged Transaction routes
			r.Route("/{organizationId}/staged-transactions", func(r chi.Router) {
				r.Get("/", stagingHandler.ListStagedTransactions)
				r.Post("/upload", stagingHandler.UploadCSV)
				r.Post("/{id}/approve", stagingHandler.ApproveStagedTransaction)
				r.Post("/{id}/reject", stagingHandler.RejectStagedTransaction)
				r.Post("/batch-post", stagingHandler.BatchPostApprovedTransactions)
			})

			// Organization-scoped Financial Reports routes
			r.Route("/{organizationId}/reports", func(r chi.Router) {
				r.Get("/trial-balance", reportsHandler.GetTrialBalance)
				r.Get("/income-statement", reportsHandler.GetIncomeStatement)
				r.Get("/balance-sheet", reportsHandler.GetBalanceSheet)
			})

			// Organization-scoped Fiscal Period Closing routes
			r.Route("/{organizationId}/fiscal-periods", func(r chi.Router) {
				r.Get("/", closingHandler.ListFiscalPeriods)
				r.Post("/generate", closingHandler.GenerateFiscalPeriods)
				r.Post("/{periodId}/close", closingHandler.ClosePeriod)
				r.Post("/{periodId}/lock", closingHandler.LockPeriod)
				r.Post("/{periodId}/unlock", closingHandler.UnlockPeriod)
			})

			// Organization-scoped Executive Dashboard routes
			r.Route("/{organizationId}/dashboard", func(r chi.Router) {
				r.Get("/metrics", dashboardHandler.GetDashboardMetrics)
			})

			// Organization-scoped Anomaly routes
			r.Route("/{organizationId}/anomalies", func(r chi.Router) {
				r.Get("/", anomalyHandler.ListAnomalies)
			})

			// Organization-scoped Data Export routes
			r.Route("/{organizationId}/export", func(r chi.Router) {
				r.Get("/ledger", exportHandler.ExportGeneralLedgerCSV)
				r.Get("/audit", exportHandler.ExportAuditLogsCSV)
			})

			// Organization-scoped Audit Trail routes
			r.Route("/{organizationId}/audit-logs", func(r chi.Router) {
				r.Get("/", auditHandler.ListAuditLogs)
			})

			// Get Organization by ID (leaf route)
			r.Get("/{organizationId}", orgHandler.GetOrganization)
		})
	})

	return r
}

func SlogLoggerMiddleware(logger *slog.Logger) func(next http.Handler) http.Handler {
	return customMiddleware.SlogLogger(logger)
}
