package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type UserHandler struct{}

func NewUserHandler() *UserHandler {
	return &UserHandler{}
}

type UserResponse struct {
	ID                     string    `json:"id"`
	IdentityProviderIssuer string    `json:"identityProviderIssuer"`
	ExternalSubjectID      string    `json:"externalSubjectId"`
	Email                  string    `json:"email"`
	FullName               string    `json:"fullName"`
	CreatedAt              time.Time `json:"createdAt"`
}

func (h *UserHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	tx, ok := middleware.GetTxFromContext(r.Context())
	if !ok || tx == nil {
		writeError(w, http.StatusInternalServerError, "TRANSACTION_MISSING", "request transaction missing")
		return
	}

	userID, ok := r.Context().Value(middleware.UserIDContextKey).(string)
	if !ok || userID == "" {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "user context missing")
		return
	}

	query := `
		SELECT id, identity_provider_issuer, external_subject_id, COALESCE(email, ''), COALESCE(full_name, ''), created_at
		FROM public.users
		WHERE id = NULLIF(current_setting('app.current_user_id', true), '')::uuid;
	`
	var u UserResponse
	err := tx.QueryRow(r.Context(), query).Scan(&u.ID, &u.IdentityProviderIssuer, &u.ExternalSubjectID, &u.Email, &u.FullName, &u.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "USER_NOT_FOUND", "user record not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(u)
}
