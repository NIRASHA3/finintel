package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type MemberHandler struct{}

func NewMemberHandler() *MemberHandler {
	return &MemberHandler{}
}

type OrgMember struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Role      string `json:"role"` // "Admin", "Controller", "Accountant", "Auditor"
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

func (h *MemberHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	members := []OrgMember{
		{ID: "mem-1", UserID: "usr-admin", Email: "admin@finintel.local", Name: "Lead Financial Admin", Role: "Admin", Status: "ACTIVE", CreatedAt: "2026-01-01T00:00:00Z"},
		{ID: "mem-2", UserID: "usr-ctrl", Email: "controller@finintel.local", Name: "Senior Controller", Role: "Controller", Status: "ACTIVE", CreatedAt: "2026-01-15T00:00:00Z"},
		{ID: "mem-3", UserID: "usr-acct", Email: "staff@finintel.local", Name: "Staff Accountant", Role: "Accountant", Status: "ACTIVE", CreatedAt: "2026-02-01T00:00:00Z"},
		{ID: "mem-4", UserID: "usr-audit", Email: "auditor@external.com", Name: "External Auditor", Role: "Auditor", Status: "ACTIVE", CreatedAt: "2026-03-01T00:00:00Z"},
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"organization_id": orgID,
		"members":         members,
	})
}

func (h *MemberHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)
	memberID := chi.URLParam(r, "memberId")

	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "invalid request body")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":   "member role updated successfully",
		"member_id": memberID,
		"org_id":    orgID,
		"new_role":  req.Role,
	})
}
