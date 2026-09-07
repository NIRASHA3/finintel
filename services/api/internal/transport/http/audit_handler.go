package http

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/audit"
	"github.com/go-chi/chi/v5"
)

type AuditHandler struct {
	service *audit.Service
}

func NewAuditHandler(service *audit.Service) *AuditHandler {
	return &AuditHandler{service: service}
}

func (h *AuditHandler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		http.Error(w, `{"message":"organizationId parameter is required"}`, http.StatusBadRequest)
		return
	}

	cursor := r.URL.Query().Get("cursor")
	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	logs, nextCursor, err := h.service.ListAuditLogs(r.Context(), orgID, cursor, limit)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	response := map[string]interface{}{
		"auditLogs": logs,
	}
	if nextCursor != "" {
		response["next_cursor"] = nextCursor
	} else {
		response["next_cursor"] = nil
	}
	_ = json.NewEncoder(w).Encode(response)
}
