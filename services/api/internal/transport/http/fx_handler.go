package http

import (
	"encoding/json"
	"net/http"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/fx"
)

type FXHandler struct {
	fxService *fx.Service
}

func NewFXHandler(fxService *fx.Service) *FXHandler {
	return &FXHandler{fxService: fxService}
}

func (h *FXHandler) ListRates(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	rates, err := h.fxService.ListRates(r.Context(), orgID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "FETCH_RATES_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rates": rates,
	})
}

func (h *FXHandler) UpsertRate(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	var req struct {
		BaseCurrency   string  `json:"base_currency"`
		TargetCurrency string  `json:"target_currency"`
		Rate           float64 `json:"rate"`
		EffectiveDate  string  `json:"effective_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "invalid JSON request body")
		return
	}

	rateObj, err := h.fxService.UpsertRate(r.Context(), orgID, req.BaseCurrency, req.TargetCurrency, req.Rate, req.EffectiveDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "UPSERT_RATE_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, rateObj)
}

func (h *FXHandler) Revalue(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	var req struct {
		BaseCurrency    string  `json:"base_currency"`
		ForeignCurrency string  `json:"foreign_currency"`
		ForeignAmount   float64 `json:"foreign_amount"`
		RevalDate       string  `json:"revaluation_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "invalid JSON request body")
		return
	}

	res, err := h.fxService.RunRevaluation(r.Context(), orgID, req.BaseCurrency, req.ForeignCurrency, req.ForeignAmount, req.RevalDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "REVALUATION_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, res)
}
