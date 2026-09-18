package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type MemberHandler struct{}

func NewMemberHandler() *MemberHandler {
	return &MemberHandler{}
}

type OrgMemberResponse struct {
	MembershipID string    `json:"membership_id"`
	UserID       string    `json:"user_id"`
	Email        string    `json:"email"`
	FullName     string    `json:"full_name"`
	Role         string    `json:"role"`
	JoinedAt     time.Time `json:"joined_at"`
}

func (h *MemberHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_PATH", "organizationId is required")
		return
	}

	tx, ok := middleware.GetTxFromContext(r.Context())
	if !ok || tx == nil {
		writeError(w, http.StatusInternalServerError, "TRANSACTION_MISSING", "request transaction missing")
		return
	}

	query := `
		SELECT membership_id, user_id, COALESCE(email, ''), COALESCE(full_name, ''), role, joined_at
		FROM public.fn_list_organization_members($1);
	`
	rows, err := tx.Query(r.Context(), query, orgID)
	if err != nil {
		writeSanitizedDbError(w, err, "LIST_MEMBERS_FAILED", "Failed to list organization members")
		return
	}
	defer rows.Close()

	var members []OrgMemberResponse
	for rows.Next() {
		var m OrgMemberResponse
		if err := rows.Scan(&m.MembershipID, &m.UserID, &m.Email, &m.FullName, &m.Role, &m.JoinedAt); err != nil {
			writeSanitizedDbError(w, err, "LIST_MEMBERS_FAILED", "Failed to list organization members")
			return
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		writeSanitizedDbError(w, err, "LIST_MEMBERS_FAILED", "Failed to list organization members")
		return
	}
	if members == nil {
		members = []OrgMemberResponse{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"organization_id": orgID,
		"members":         members,
	})
}

func (h *MemberHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_PATH", "organizationId is required")
		return
	}

	tx, ok := middleware.GetTxFromContext(r.Context())
	if !ok || tx == nil {
		writeError(w, http.StatusInternalServerError, "TRANSACTION_MISSING", "request transaction missing")
		return
	}

	var req struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "invalid request body")
		return
	}

	correlationID := r.Header.Get("X-Correlation-ID")
	if correlationID == "" {
		correlationID = uuid.NewString()
	}

	query := `SELECT public.fn_add_member($1, $2, $3, $4);`
	_, err := tx.Exec(r.Context(), query, orgID, req.UserID, req.Role, correlationID)
	if err != nil {
		writeSanitizedDbError(w, err, "ADD_MEMBER_FAILED", "Failed to add member to organization")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "member added successfully",
		"org_id":  orgID,
		"user_id": req.UserID,
		"role":    req.Role,
	})
}

func (h *MemberHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_PATH", "organizationId is required")
		return
	}
	targetUserID := chi.URLParam(r, "memberId")
	tx, ok := middleware.GetTxFromContext(r.Context())
	if !ok || tx == nil {
		writeError(w, http.StatusInternalServerError, "TRANSACTION_MISSING", "request transaction missing")
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "invalid request body")
		return
	}

	correlationID := r.Header.Get("X-Correlation-ID")
	if correlationID == "" {
		correlationID = uuid.NewString()
	}

	query := `SELECT public.fn_update_member_role($1, $2, $3, $4);`
	_, err := tx.Exec(r.Context(), query, orgID, targetUserID, req.Role, correlationID)
	if err != nil {
		writeSanitizedDbError(w, err, "ROLE_UPDATE_FAILED", "Failed to update member role")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":        "member role updated successfully",
		"target_user_id": targetUserID,
		"org_id":         orgID,
		"new_role":       req.Role,
	})
}

func (h *MemberHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)
	if orgID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_PATH", "organizationId is required")
		return
	}
	targetUserID := chi.URLParam(r, "memberId")
	tx, ok := middleware.GetTxFromContext(r.Context())
	if !ok || tx == nil {
		writeError(w, http.StatusInternalServerError, "TRANSACTION_MISSING", "request transaction missing")
		return
	}

	correlationID := r.Header.Get("X-Correlation-ID")
	if correlationID == "" {
		correlationID = uuid.NewString()
	}

	query := `SELECT public.fn_remove_member($1, $2, $3);`
	_, err := tx.Exec(r.Context(), query, orgID, targetUserID, correlationID)
	if err != nil {
		writeSanitizedDbError(w, err, "REMOVE_MEMBER_FAILED", "Failed to remove member from organization")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":        "member removed successfully",
		"target_user_id": targetUserID,
		"org_id":         orgID,
	})
}
