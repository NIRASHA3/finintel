package http

import (
	"encoding/json"
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
	"github.com/NIRASHA3/finintel/services/api/internal/domain/ledger"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/organization"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/reports"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/reversal"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/staging"
	"github.com/NIRASHA3/finintel/services/api/internal/platform/oidc"
	customMiddleware "github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

func NewRouter(db PingerProvider, logger *slog.Logger) http.Handler {
	defaultCfg := &config.Config{
		CorsAllowedOrigins: []string{"http://localhost:3000"},
		OIDCIssuerURL:      "https://auth.finintel.internal",
		OIDCAudience:       "finintel-api",
		OIDCJwksURL:        "https://auth.finintel.internal/.well-known/jwks.json",
	}
	return NewRouterWithConfig(db, logger, defaultCfg)
}

func notImplementedHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   "NOT_IMPLEMENTED",
		"message": "Feature disabled in Track 1 security remediation",
	})
}

func NewRouterWithConfig(db PingerProvider, logger *slog.Logger, cfg *config.Config) http.Handler {
	r := chi.NewRouter()

	allowedOrigins := []string{"http://localhost:3000"}
	if cfg != nil && len(cfg.CorsAllowedOrigins) > 0 {
		allowedOrigins = cfg.CorsAllowedOrigins
	}

	// Middleware pipeline:
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(customMiddleware.CORS(allowedOrigins))
	r.Use(customMiddleware.SlogLogger(logger))
	r.Use(customMiddleware.RateLimit(100, 200))
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

	issuerURL := ""
	audience := ""
	jwksURL := ""
	var allowedAlgs []string
	if cfg != nil {
		issuerURL = cfg.OIDCIssuerURL
		audience = cfg.OIDCAudience
		jwksURL = cfg.OIDCJwksURL
		allowedAlgs = cfg.OIDCAllowedAlgs
	}

	oidcValidator := oidc.NewValidator(oidc.ValidatorConfig{
		IssuerURL:   issuerURL,
		Audience:    audience,
		JwksURL:     jwksURL,
		AllowedAlgs: allowedAlgs,
	})

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
	memberHandler := NewMemberHandler()

	allFiveRoles := []string{"OWNER", "ADMINISTRATOR", "ACCOUNTANT", "ANALYST", "AUDITOR_VIEWER"}
	adminOwnerOnly := []string{"OWNER", "ADMINISTRATOR"}
	accountAndJournalMutate := []string{"OWNER", "ADMINISTRATOR", "ACCOUNTANT"}
	stagedList := []string{"OWNER", "ADMINISTRATOR", "ACCOUNTANT", "ANALYST"}
	stagedMutate := []string{"OWNER", "ADMINISTRATOR", "ACCOUNTANT"}
	fiscalPeriodMutate := []string{"OWNER", "ADMINISTRATOR"}
	dashboardAndAnomalies := []string{"OWNER", "ADMINISTRATOR", "ACCOUNTANT", "ANALYST"}
	ledgerExport := []string{"OWNER", "ADMINISTRATOR", "ACCOUNTANT", "AUDITOR_VIEWER"}
	auditLogsAndExport := []string{"OWNER", "ADMINISTRATOR", "AUDITOR_VIEWER"}

	// API v1 Protected Routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(customMiddleware.RequireAuth(oidcValidator))
		r.Use(customMiddleware.UserScopedTxMiddleware(pool))

		r.Get("/users/me", userHandler.GetCurrentUser)

		r.Route("/organizations", func(r chi.Router) {
			r.Post("/", orgHandler.CreateOrganization)
			r.Get("/", orgHandler.ListOrganizations)

			// Tenant-scoped routes under /{organizationId}
			r.Route("/{organizationId}", func(r chi.Router) {
				r.Use(customMiddleware.TenantScopedTxMiddleware)

				r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/", orgHandler.GetOrganization)

				// Organization Members routes
				r.Route("/members", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(adminOwnerOnly...)).Get("/", memberHandler.ListMembers)
					r.With(customMiddleware.RequireRole(adminOwnerOnly...)).Post("/", memberHandler.AddMember)
					r.With(customMiddleware.RequireRole(adminOwnerOnly...)).Put("/{memberId}/role", memberHandler.UpdateMemberRole)
					r.With(customMiddleware.RequireRole(adminOwnerOnly...)).Delete("/{memberId}", memberHandler.RemoveMember)
				})

				// Accounts routes
				r.Route("/accounts", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/", accHandler.ListAccounts)
					r.With(customMiddleware.RequireRole(accountAndJournalMutate...)).Post("/", accHandler.CreateAccount)
					r.With(customMiddleware.RequireRole(adminOwnerOnly...)).Post("/seed", accHandler.SeedDefaultAccounts)
				})

				// Ledger routes
				r.Route("/journal-entries", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/", ledgerHandler.ListJournalEntries)
					r.With(customMiddleware.RequireRole(accountAndJournalMutate...)).Post("/", ledgerHandler.PostJournalEntry)
					r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/{entryId}", ledgerHandler.GetJournalEntry)
					r.With(customMiddleware.RequireRole(accountAndJournalMutate...)).Post("/{entryId}/reverse", reversalHandler.PostReversalEntry)
				})

				// Staged Transactions routes
				r.Route("/staged-transactions", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(stagedList...)).Get("/", stagingHandler.ListStagedTransactions)
					r.With(customMiddleware.RequireRole(stagedMutate...)).Post("/upload", stagingHandler.UploadCSV)
					r.With(customMiddleware.RequireRole(stagedMutate...)).Post("/{id}/approve", stagingHandler.ApproveStagedTransaction)
					r.With(customMiddleware.RequireRole(stagedMutate...)).Post("/{id}/reject", stagingHandler.RejectStagedTransaction)
					r.With(customMiddleware.RequireRole(stagedMutate...)).Post("/batch-post", stagingHandler.BatchPostApprovedTransactions)
				})

				// Reports routes
				r.Route("/reports", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/trial-balance", reportsHandler.GetTrialBalance)
					r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/income-statement", reportsHandler.GetIncomeStatement)
					r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/balance-sheet", reportsHandler.GetBalanceSheet)
				})

				// Fiscal Period Closing routes
				r.Route("/fiscal-periods", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(allFiveRoles...)).Get("/", closingHandler.ListFiscalPeriods)
					r.With(customMiddleware.RequireRole(fiscalPeriodMutate...)).Post("/generate", closingHandler.GenerateFiscalPeriods)
					r.With(customMiddleware.RequireRole(fiscalPeriodMutate...)).Post("/{periodId}/close", closingHandler.ClosePeriod)
					r.With(customMiddleware.RequireRole(fiscalPeriodMutate...)).Post("/{periodId}/lock", closingHandler.LockPeriod)
					r.With(customMiddleware.RequireRole(fiscalPeriodMutate...)).Post("/{periodId}/unlock", closingHandler.UnlockPeriod)
				})

				// Dashboard routes
				r.Route("/dashboard", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(dashboardAndAnomalies...)).Get("/metrics", dashboardHandler.GetDashboardMetrics)
				})

				// Anomaly routes
				r.Route("/anomalies", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(dashboardAndAnomalies...)).Get("/", anomalyHandler.ListAnomalies)
				})

				// Data Export routes
				r.Route("/export", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(ledgerExport...)).Get("/ledger", exportHandler.ExportGeneralLedgerCSV)
					r.With(customMiddleware.RequireRole(auditLogsAndExport...)).Get("/audit", exportHandler.ExportAuditLogsCSV)
				})

				// Audit Trail routes
				r.Route("/audit-logs", func(r chi.Router) {
					r.With(customMiddleware.RequireRole(auditLogsAndExport...)).Get("/", auditHandler.ListAuditLogs)
				})

				// Moved Track 3 / disabled endpoints (return 501 after auth & tenant membership check)
				r.Post("/reconciliations/match", notImplementedHandler)
				r.Get("/webhooks/subscriptions", notImplementedHandler)
				r.Post("/webhooks/subscriptions", notImplementedHandler)
				r.Delete("/webhooks/subscriptions/{id}", notImplementedHandler)
				r.Get("/fx-rates", notImplementedHandler)
				r.Post("/fx-rates", notImplementedHandler)
				r.Post("/fx-rates/revalue", notImplementedHandler)
			})
		})
	})

	return r
}

func SlogLoggerMiddleware(logger *slog.Logger) func(next http.Handler) http.Handler {
	return customMiddleware.SlogLogger(logger)
}
