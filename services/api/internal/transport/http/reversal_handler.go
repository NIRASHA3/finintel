package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/reversal"
	customMiddleware "github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type ReversalHandler struct {
	reversalService *reversal.Service
}

func NewReversalHandler(reversalService *reversal.Service) *ReversalHandler {
	return &ReversalHandler{reversalService: reversalService}
}

func (h *ReversalHandler) PostReversalEntry(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	entryID := chi.URLParam(r, "entryId")
	if orgID == "" || entryID == "" {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://api.finintel.com/errors/invalid-parameter",
			"title":  "Bad Request",
			"status": 400,
			"detail": "organizationId and entryId path parameters are required",
		})
		return
	}

	var req reversal.ReversalParams
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://api.finintel.com/errors/invalid-json",
			"title":  "Invalid JSON Request Payload",
			"status": 400,
			"detail": err.Error(),
		})
		return
	}

	var userID string
	if u, ok := customMiddleware.GetUserFromContext(r.Context()); ok {
		userID = u.ID
	}
	correlationID := middleware.GetReqID(r.Context())

	reversalEntry, err := h.reversalService.PostReversalEntry(r.Context(), orgID, entryID, userID, correlationID, req.Reason)
	if err != nil {
		w.Header().Set("Content-Type", "application/problem+json")
		status := http.StatusInternalServerError
		code := "internal-error"

		if errors.Is(err, reversal.ErrEntryNotFound) {
			status = http.StatusNotFound
			code = "entry-not-found"
		} else if errors.Is(err, reversal.ErrEntryNotPosted) || errors.Is(err, reversal.ErrAlreadyReversed) || errors.Is(err, reversal.ErrFiscalPeriodLocked) || errors.Is(err, reversal.ErrReasonRequired) {
			status = http.StatusUnprocessableEntity
			code = "invalid-reversal-state"
		}

		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://api.finintel.com/errors/" + code,
			"title":  "Reversal Posting Failed",
			"status": status,
			"detail": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(reversalEntry)
}
