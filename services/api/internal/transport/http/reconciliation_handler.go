package http

import (
	"encoding/json"
	"net/http"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/reconciliation"
)

type ReconciliationHandler struct {
	recService *reconciliation.Service
}

func NewReconciliationHandler(recService *reconciliation.Service) *ReconciliationHandler {
	return &ReconciliationHandler{recService: recService}
}

func (h *ReconciliationHandler) AutoMatch(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	var req struct {
		Transactions []reconciliation.BankTransaction `json:"transactions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "invalid JSON request body")
		return
	}

	matches, err := h.recService.AutoMatch(r.Context(), orgID, req.Transactions)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "MATCHING_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"matches":     matches,
		"total_items": len(matches),
	})
}
