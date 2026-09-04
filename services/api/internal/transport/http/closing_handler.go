package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/NIRASHA3/finintel/services/api/internal/domain/closing"
	customMiddleware "github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

type ClosingHandler struct {
	service *closing.Service
}

func NewClosingHandler(service *closing.Service) *ClosingHandler {
	return &ClosingHandler{service: service}
}

type GeneratePeriodsRequest struct {
	FiscalYear int `json:"fiscalYear"`
}

func (h *ClosingHandler) ListFiscalPeriods(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		http.Error(w, `{"message":"organizationId parameter is required"}`, http.StatusBadRequest)
		return
	}

	periods, err := h.service.ListFiscalPeriods(r.Context(), orgID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"fiscalPeriods": periods})
}

func (h *ClosingHandler) GenerateFiscalPeriods(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		http.Error(w, `{"message":"organizationId parameter is required"}`, http.StatusBadRequest)
		return
	}

	var req GeneratePeriodsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.FiscalYear == 0 {
		req.FiscalYear = time.Now().UTC().Year()
	}

	periods, err := h.service.GenerateFiscalPeriods(r.Context(), orgID, req.FiscalYear)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"fiscalPeriods": periods})
}

func (h *ClosingHandler) ClosePeriod(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	periodID := chi.URLParam(r, "periodId")
	var userID string
	if u, ok := customMiddleware.GetUserFromContext(r.Context()); ok {
		userID = u.ID
	}

	period, err := h.service.CloseFiscalPeriod(r.Context(), orgID, periodID, userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(period)
}

func (h *ClosingHandler) LockPeriod(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	periodID := chi.URLParam(r, "periodId")
	var userID string
	if u, ok := customMiddleware.GetUserFromContext(r.Context()); ok {
		userID = u.ID
	}

	period, err := h.service.LockFiscalPeriod(r.Context(), orgID, periodID, userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(period)
}

func (h *ClosingHandler) UnlockPeriod(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	periodID := chi.URLParam(r, "periodId")
	var userID string
	if u, ok := customMiddleware.GetUserFromContext(r.Context()); ok {
		userID = u.ID
	}

	period, err := h.service.UnlockFiscalPeriod(r.Context(), orgID, periodID, userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(period)
}
