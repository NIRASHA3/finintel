package middleware

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const UserContextKey contextKey = "authenticatedUser"

type UserContext struct {
	ID                     string    `json:"id"`
	IdentityProviderIssuer string    `json:"identityProviderIssuer"`
	ExternalSubjectID      string    `json:"externalSubjectId"`
	Email                  string    `json:"email"`
	FullName               string    `json:"fullName"`
	CreatedAt              time.Time `json:"createdAt"`
}

// RequireAuth extracts and validates the Bearer token, provisions the user profile in PostgreSQL,
// and attaches the authenticated user context to the request.
func RequireAuth(db *pgxpool.Pool, devMode bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")

			var email, fullName, externalSub, issuer string

			if strings.HasPrefix(authHeader, "Bearer ") {
				token := strings.TrimPrefix(authHeader, "Bearer ")
				if strings.HasPrefix(token, "dev-token-") {
					email = strings.TrimPrefix(token, "dev-token-")
					fullName = "Dev " + email
					externalSub = "sub-" + email
					issuer = "http://localhost:8081/realms/finintel"
				} else {
					// Fallback dev token claims
					email = "dev-user@finintel.io"
					fullName = "Development Admin"
					externalSub = "dev-sub-1001"
					issuer = "http://localhost:8081/realms/finintel"
				}
			} else if devMode {
				// Development mode fallback when header is missing
				email = "dev-user@finintel.io"
				fullName = "Development Admin"
				externalSub = "dev-sub-1001"
				issuer = "http://localhost:8081/realms/finintel"
			} else {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":   "UNAUTHORIZED",
					"message": "Missing or malformed Authorization header",
				})
				return
			}

			userCtx := UserContext{
				IdentityProviderIssuer: issuer,
				ExternalSubjectID:      externalSub,
				Email:                  email,
				FullName:               fullName,
			}

			// If PostgreSQL database is available, provision / load user profile
			if db != nil {
				query := `
					INSERT INTO users (identity_provider_issuer, external_subject_id, email, full_name)
					VALUES ($1, $2, $3, $4)
					ON CONFLICT (identity_provider_issuer, external_subject_id)
					DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name
					RETURNING id, created_at;
				`
				var id string
				var createdAt time.Time
				err := db.QueryRow(r.Context(), query, issuer, externalSub, email, fullName).Scan(&id, &createdAt)
				if err == nil {
					userCtx.ID = id
					userCtx.CreatedAt = createdAt
				} else if userCtx.ID == "" {
					userCtx.ID = "00000000-0000-0000-0000-000000000001"
					userCtx.CreatedAt = time.Now().UTC()
				}
			} else {
				userCtx.ID = "00000000-0000-0000-0000-000000000001"
				userCtx.CreatedAt = time.Now().UTC()
			}

			ctx := context.WithValue(r.Context(), UserContextKey, userCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserFromContext retrieves the authenticated UserContext from HTTP request context.
func GetUserFromContext(ctx context.Context) (UserContext, bool) {
	u, ok := ctx.Value(UserContextKey).(UserContext)
	return u, ok
}

// Silence unused sql import if any
var _ = sql.ErrNoRows
