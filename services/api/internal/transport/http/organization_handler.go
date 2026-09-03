package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/organization"
	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type OrganizationHandler struct {
	orgService *organization.Service
}

func NewOrganizationHandler(orgService *organization.Service) *OrganizationHandler {
	return &OrganizationHandler{orgService: orgService}
}

func (h *OrganizationHandler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	u, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization context")
		return
	}

	var req organization.CreateOrganizationParams
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON request payload")
		return
	}

	correlationID := r.Header.Get("X-Correlation-ID")

	org, err := h.orgService.CreateOrganization(r.Context(), u.ID, correlationID, req)
	if err != nil {
		if errors.Is(err, organization.ErrInvalidName) {
			writeJSONError(w, http.StatusBadRequest, "INVALID_INPUT", err.Error())
			return
		}
		slog.Error("failed to create organization", slog.Any("error", err))
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(org)
}

func (h *OrganizationHandler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	u, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization context")
		return
	}

	orgs, err := h.orgService.ListOrganizationsForUser(r.Context(), u.ID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list user organizations")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"organizations": orgs,
	})
}

func (h *OrganizationHandler) GetOrganization(w http.ResponseWriter, r *http.Request) {
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

	org, err := h.orgService.GetOrganizationByID(r.Context(), orgID, u.ID)
	if err != nil {
		if errors.Is(err, organization.ErrOrganizationFound) {
			writeJSONError(w, http.StatusNotFound, "NOT_FOUND", "Organization not found or access denied")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to fetch organization details")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(org)
}

func writeJSONError(w http.ResponseWriter, statusCode int, errorCode string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   errorCode,
		"message": message,
	})
}
