package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/dashboard"
)

type DashboardHandler struct {
	dashboardService *dashboard.Service
}

func NewDashboardHandler(dashboardService *dashboard.Service) *DashboardHandler {
	return &DashboardHandler{dashboardService: dashboardService}
}

func (h *DashboardHandler) GetDashboardMetrics(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://api.finintel.com/errors/invalid-parameter",
			"title":  "Bad Request",
			"status": 400,
			"detail": "organizationId path parameter is required",
		})
		return
	}

	metrics, err := h.dashboardService.GetDashboardMetrics(r.Context(), orgID)
	if err != nil {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://api.finintel.com/errors/internal-error",
			"title":  "Dashboard Metrics Computation Failed",
			"status": 500,
			"detail": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(metrics)
}
