package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/ledger"
	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type LedgerHandler struct {
	ledgerService *ledger.Service
}

func NewLedgerHandler(ledgerService *ledger.Service) *LedgerHandler {
	return &LedgerHandler{ledgerService: ledgerService}
}

func (h *LedgerHandler) PostJournalEntry(w http.ResponseWriter, r *http.Request) {
	u, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization context")
		return
	}

	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Organization ID path parameter required")
		return
	}

	var req ledger.CreateJournalEntryParams
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON request payload")
		return
	}

	correlationID := r.Header.Get("X-Correlation-ID")

	entry, err := h.ledgerService.PostJournalEntry(r.Context(), orgID, u.ID, correlationID, req)
	if err != nil {
		if errors.Is(err, ledger.ErrUnbalancedJournalEntry) {
			writeJSONError(w, http.StatusBadRequest, "UNBALANCED_JOURNAL_ENTRY", err.Error())
			return
		}
		if errors.Is(err, ledger.ErrInvalidEntryLines) || errors.Is(err, ledger.ErrInvalidLineAmount) || errors.Is(err, ledger.ErrDescriptionRequired) {
			writeJSONError(w, http.StatusBadRequest, "INVALID_INPUT", err.Error())
			return
		}
		if errors.Is(err, ledger.ErrAccountNotFound) {
			writeJSONError(w, http.StatusBadRequest, "ACCOUNT_NOT_FOUND", err.Error())
			return
		}
		slog.Error("failed to post journal entry", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to post journal entry: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(entry)
}

func (h *LedgerHandler) ListJournalEntries(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization context")
		return
	}

	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Organization ID path parameter required")
		return
	}

	entries, err := h.ledgerService.ListJournalEntries(r.Context(), orgID)
	if err != nil {
		slog.Error("failed to list journal entries", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list journal entries")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"entries": entries,
	})
}

func (h *LedgerHandler) GetJournalEntry(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization context")
		return
	}

	orgID := chi.URLParam(r, "organizationId")
	entryID := chi.URLParam(r, "entryId")
	if orgID == "" || entryID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Organization ID and Entry ID path parameters required")
		return
	}

	entry, err := h.ledgerService.GetJournalEntryByID(r.Context(), orgID, entryID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "NOT_FOUND", "Journal entry not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(entry)
}
