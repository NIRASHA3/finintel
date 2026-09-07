package http

import (
	"encoding/json"
	"net/http"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/reports"
	"github.com/go-chi/chi/v5"
)

type ReportsHandler struct {
	service *reports.Service
}

func NewReportsHandler(service *reports.Service) *ReportsHandler {
	return &ReportsHandler{service: service}
}

func (h *ReportsHandler) GetTrialBalance(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		http.Error(w, `{"message":"organizationId parameter is required"}`, http.StatusBadRequest)
		return
	}

	asOfDate := r.URL.Query().Get("asOfDate")

	report, err := h.service.GetTrialBalance(r.Context(), orgID, asOfDate)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(report)
}

func (h *ReportsHandler) GetIncomeStatement(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		http.Error(w, `{"message":"organizationId parameter is required"}`, http.StatusBadRequest)
		return
	}

	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")

	report, err := h.service.GetIncomeStatement(r.Context(), orgID, startDate, endDate)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(report)
}

func (h *ReportsHandler) GetBalanceSheet(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		http.Error(w, `{"message":"organizationId parameter is required"}`, http.StatusBadRequest)
		return
	}

	asOfDate := r.URL.Query().Get("asOfDate")

	report, err := h.service.GetBalanceSheet(r.Context(), orgID, asOfDate)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(report)
}
