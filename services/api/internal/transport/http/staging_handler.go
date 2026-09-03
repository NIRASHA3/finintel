package http

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/staging"
	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type StagingHandler struct {
	stagingService *staging.Service
}

func NewStagingHandler(stagingService *staging.Service) *StagingHandler {
	return &StagingHandler{stagingService: stagingService}
}

func (h *StagingHandler) UploadCSV(w http.ResponseWriter, r *http.Request) {
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

	var reader io.Reader
	file, _, err := r.FormFile("file")
	if err == nil {
		defer file.Close()
		reader = file
	} else {
		// Fallback to reading raw body
		bodyBytes, readErr := io.ReadAll(r.Body)
		if readErr != nil || len(bodyBytes) == 0 {
			writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "CSV file upload required in 'file' form field or request body")
			return
		}
		reader = bytes.NewReader(bodyBytes)
	}

	count, err := h.stagingService.ParseAndStageCSV(r.Context(), orgID, reader)
	if err != nil {
		slog.Error("failed to parse and stage CSV", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to parse and stage CSV: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"insertedCount": count,
		"message":       "CSV transactions parsed and staged successfully",
	})
}

func (h *StagingHandler) ListStagedTransactions(w http.ResponseWriter, r *http.Request) {
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

	statusFilter := r.URL.Query().Get("status")
	items, err := h.stagingService.ListStagedTransactions(r.Context(), orgID, statusFilter)
	if err != nil {
		slog.Error("failed to list staged transactions", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list staged transactions")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"stagedTransactions": items,
	})
}

type approveRequest struct {
	AccountId string `json:"accountId"`
}

func (h *StagingHandler) ApproveStagedTransaction(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization context")
		return
	}

	orgID := chi.URLParam(r, "organizationId")
	id := chi.URLParam(r, "id")
	if orgID == "" || id == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Organization ID and Transaction ID path parameters required")
		return
	}

	var req approveRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	item, err := h.stagingService.ApproveStagedTransaction(r.Context(), orgID, id, req.AccountId)
	if err != nil {
		if errors.Is(err, staging.ErrTargetAccountRequired) {
			writeJSONError(w, http.StatusBadRequest, "TARGET_ACCOUNT_REQUIRED", err.Error())
			return
		}
		if errors.Is(err, staging.ErrTransactionNotFound) {
			writeJSONError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}
		slog.Error("failed to approve staged transaction", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to approve staged transaction")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(item)
}

func (h *StagingHandler) RejectStagedTransaction(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization context")
		return
	}

	orgID := chi.URLParam(r, "organizationId")
	id := chi.URLParam(r, "id")
	if orgID == "" || id == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Organization ID and Transaction ID path parameters required")
		return
	}

	item, err := h.stagingService.RejectStagedTransaction(r.Context(), orgID, id)
	if err != nil {
		if errors.Is(err, staging.ErrTransactionNotFound) {
			writeJSONError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}
		slog.Error("failed to reject staged transaction", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to reject staged transaction")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(item)
}

func (h *StagingHandler) BatchPostApprovedTransactions(w http.ResponseWriter, r *http.Request) {
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

	res, err := h.stagingService.BatchPostApprovedTransactions(r.Context(), orgID, u.ID)
	if err != nil {
		if errors.Is(err, staging.ErrNoTransactionsToPost) {
			writeJSONError(w, http.StatusBadRequest, "NO_APPROVED_TRANSACTIONS", err.Error())
			return
		}
		if errors.Is(err, staging.ErrCashAccountNotFound) {
			writeJSONError(w, http.StatusBadRequest, "CASH_ACCOUNT_MISSING", err.Error())
			return
		}
		slog.Error("failed to batch post approved transactions", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to batch post approved transactions: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(res)
}
