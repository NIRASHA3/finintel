package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/account"
	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type AccountHandler struct {
	accService *account.Service
}

func NewAccountHandler(accService *account.Service) *AccountHandler {
	return &AccountHandler{accService: accService}
}

func (h *AccountHandler) ListAccounts(w http.ResponseWriter, r *http.Request) {
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

	accounts, err := h.accService.ListAccounts(r.Context(), orgID)
	if err != nil {
		slog.Error("failed to list accounts", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list Chart of Accounts")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"accounts": accounts,
	})
}

func (h *AccountHandler) CreateAccount(w http.ResponseWriter, r *http.Request) {
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

	var req account.CreateAccountParams
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON request payload")
		return
	}

	acc, err := h.accService.CreateAccount(r.Context(), orgID, req)
	if err != nil {
		if errors.Is(err, account.ErrInvalidAccountCode) || errors.Is(err, account.ErrInvalidAccountName) || errors.Is(err, account.ErrInvalidAccountType) {
			writeJSONError(w, http.StatusBadRequest, "INVALID_INPUT", err.Error())
			return
		}
		if errors.Is(err, account.ErrAccountAlreadyExists) {
			writeJSONError(w, http.StatusConflict, "DUPLICATE_ACCOUNT_CODE", err.Error())
			return
		}
		slog.Error("failed to create account", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create account")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(acc)
}

func (h *AccountHandler) SeedDefaultAccounts(w http.ResponseWriter, r *http.Request) {
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

	accounts, err := h.accService.SeedDefaultAccounts(r.Context(), orgID)
	if err != nil {
		slog.Error("failed to seed accounts", slog.String("organization_id", orgID), slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to seed default Chart of Accounts")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"accounts": accounts,
	})
}
