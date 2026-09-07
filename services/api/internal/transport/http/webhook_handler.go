package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/webhook"
)

type WebhookHandler struct {
	webhookService *webhook.Service
}

func NewWebhookHandler(webhookService *webhook.Service) *WebhookHandler {
	return &WebhookHandler{webhookService: webhookService}
}

func (h *WebhookHandler) CreateSubscription(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	var req struct {
		TargetURL string   `json:"target_url"`
		Events    []string `json:"events"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "invalid JSON request body")
		return
	}

	sub, err := h.webhookService.CreateSubscription(r.Context(), orgID, req.TargetURL, req.Events)
	if err != nil {
		writeError(w, http.StatusBadRequest, "SUBSCRIPTION_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, sub)
}

func (h *WebhookHandler) ListSubscriptions(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	subs, err := h.webhookService.ListSubscriptions(r.Context(), orgID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"subscriptions": subs,
	})
}

func (h *WebhookHandler) DeleteSubscription(w http.ResponseWriter, r *http.Request) {
	orgID := getOrgIDFromRequest(r)

	subID := chi.URLParam(r, "id")
	if subID == "" {
		writeError(w, http.StatusBadRequest, "ID_REQUIRED", "subscription id param is required")
		return
	}

	if err := h.webhookService.DeleteSubscription(r.Context(), orgID, subID); err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "subscription deleted successfully",
	})
}
