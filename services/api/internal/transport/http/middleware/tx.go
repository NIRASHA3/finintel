package middleware

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	TxContextKey             contextKey = "requestTx"
	UserIDContextKey         contextKey = "authenticatedUserID"
	OrganizationIDContextKey contextKey = "currentOrganizationID"
	RoleContextKey           contextKey = "currentRole"
)

type UserContext struct {
	ID       string
	Email    string
	Role     string
	OrgID    string
	FullName string
}

func GetUserFromContext(ctx context.Context) (UserContext, bool) {
	id, ok := ctx.Value(UserIDContextKey).(string)
	if !ok || id == "" {
		return UserContext{}, false
	}
	role, _ := ctx.Value(RoleContextKey).(string)
	orgID, _ := ctx.Value(OrganizationIDContextKey).(string)

	email := ""
	fullName := ""
	if claims, ok := GetClaimsFromContext(ctx); ok {
		email = claims.Email
		fullName = claims.FullName
	}

	return UserContext{
		ID:       id,
		Email:    email,
		Role:     role,
		OrgID:    orgID,
		FullName: fullName,
	}, true
}

type DBTX interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type ResponseBuffer struct {
	http.ResponseWriter
	StatusCode  int
	Body        bytes.Buffer
	HeaderMap   http.Header
	WroteHeader bool
	Overflow    bool
}

func NewResponseBuffer(w http.ResponseWriter) *ResponseBuffer {
	return &ResponseBuffer{
		ResponseWriter: w,
		StatusCode:     http.StatusOK,
		HeaderMap:      make(http.Header),
	}
}

func (b *ResponseBuffer) Header() http.Header {
	return b.HeaderMap
}

func (b *ResponseBuffer) WriteHeader(statusCode int) {
	if !b.WroteHeader {
		b.StatusCode = statusCode
		b.WroteHeader = true
	}
}

func (b *ResponseBuffer) Write(data []byte) (int, error) {
	if !b.WroteHeader {
		b.WriteHeader(http.StatusOK)
	}
	if b.Body.Len()+len(data) > 10*1024*1024 {
		b.Overflow = true
		return 0, fmt.Errorf("response body buffer limit (10MB) exceeded")
	}
	return b.Body.Write(data)
}

func (b *ResponseBuffer) FlushTo(w http.ResponseWriter) {
	for k, v := range b.HeaderMap {
		for _, val := range v {
			w.Header().Add(k, val)
		}
	}
	w.WriteHeader(b.StatusCode)
	_, _ = w.Write(b.Body.Bytes())
}

// UserScopedTxMiddleware opens a single request transaction, provisions the user profile,
// sets app.current_user_id, buffers the response, and commits before flushing.
func UserScopedTxMiddleware(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := GetClaimsFromContext(r.Context())
			if !ok || claims == nil {
				writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authentication claims")
				return
			}

			tx, err := pool.Begin(r.Context())
			if err != nil {
				writeJSONError(w, http.StatusServiceUnavailable, "DATABASE_UNAVAILABLE", "Failed to begin database transaction")
				return
			}

			var userID string
			err = tx.QueryRow(r.Context(), `
				SELECT id FROM public.fn_provision_user($1, $2, $3, $4)
			`, claims.Issuer, claims.Subject, claims.Email, claims.FullName).Scan(&userID)

			if err != nil {
				cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = tx.Rollback(cleanupCtx)
				cancel()
				writeJSONError(w, http.StatusInternalServerError, "PROVISIONING_FAILED", "Failed to provision user profile")
				return
			}

			_, err = tx.Exec(r.Context(), "SELECT set_config('app.current_user_id', $1, true)", userID)
			if err != nil {
				cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = tx.Rollback(cleanupCtx)
				cancel()
				writeJSONError(w, http.StatusInternalServerError, "TRANSACTION_CONTEXT_ERROR", "Failed to set user context")
				return
			}

			ctx := context.WithValue(r.Context(), TxContextKey, tx)
			ctx = context.WithValue(ctx, UserIDContextKey, userID)

			bufWriter := NewResponseBuffer(w)

			panicked := true
			defer func() {
				if panicked {
					cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					_ = tx.Rollback(cleanupCtx)
					cancel()
				}
			}()

			next.ServeHTTP(bufWriter, r.WithContext(ctx))
			panicked = false

			if bufWriter.Overflow {
				cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = tx.Rollback(cleanupCtx)
				cancel()
				writeJSONError(w, http.StatusInternalServerError, "RESPONSE_OVERFLOW", "Response buffer limit exceeded")
				return
			}

			if bufWriter.StatusCode >= 400 || r.Context().Err() != nil {
				cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = tx.Rollback(cleanupCtx)
				cancel()
				bufWriter.FlushTo(w)
				return
			}

			cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := tx.Commit(cleanupCtx); err != nil {
				writeJSONError(w, http.StatusInternalServerError, "COMMIT_FAILED", "Failed to commit transaction")
				return
			}

			bufWriter.FlushTo(w)
		})
	}
}

// TenantScopedTxMiddleware validates the organization path parameter, sets app.current_organization_id FIRST,
// queries caller membership, and attaches the validated role to context.
func TenantScopedTxMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		orgIDStr := chi.URLParam(r, "organizationId")
		if orgIDStr == "" {
			writeJSONError(w, http.StatusBadRequest, "INVALID_PATH", "Organization ID parameter is required")
			return
		}

		orgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "INVALID_PATH", "Organization ID must be a valid UUID")
			return
		}

		tx, ok := r.Context().Value(TxContextKey).(pgx.Tx)
		if !ok || tx == nil {
			writeJSONError(w, http.StatusInternalServerError, "TRANSACTION_MISSING", "Request transaction missing")
			return
		}

		// Step 1: Set Organization Scope FIRST to resolve RLS circular dependency
		_, err = tx.Exec(r.Context(), "SELECT set_config('app.current_organization_id', $1, true)", orgID.String())
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "TENANT_CONTEXT_ERROR", "Failed to set organization context")
			return
		}

		// Step 2: Query caller membership specifically for app.current_user_id
		var role string
		err = tx.QueryRow(r.Context(), `
			SELECT role FROM public.organization_memberships
			WHERE organization_id = $1
			  AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
		`, orgID).Scan(&role)

		if errors.Is(err, pgx.ErrNoRows) || role == "" {
			writeJSONError(w, http.StatusForbidden, "TENANT_ACCESS_DENIED", "Caller has no active membership in target organization")
			return
		} else if err != nil {
			writeJSONError(w, http.StatusServiceUnavailable, "DATABASE_ERROR", "Failed to query organization membership")
			return
		}

		ctx := context.WithValue(r.Context(), OrganizationIDContextKey, orgID.String())
		ctx = context.WithValue(ctx, RoleContextKey, role)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetTxFromContext retrieves the transaction DBTX from request context.
func GetTxFromContext(ctx context.Context) (DBTX, bool) {
	tx, ok := ctx.Value(TxContextKey).(pgx.Tx)
	return tx, ok
}
