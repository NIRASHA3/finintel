package http

import (
	"context"
	"encoding/json"
	"net/http"
)

type DBPinger interface {
	Ping(ctx context.Context) error
}

type HealthHandler struct {
	db PingerProvider
}

type PingerProvider interface {
	Ping(ctx context.Context) error
}

type LiveResponse struct {
	Status string `json:"status"`
}

type ReadyResponse struct {
	Status string            `json:"status"`
	Checks map[string]string `json:"checks"`
}

func NewHealthHandler(db PingerProvider) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Live(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(LiveResponse{Status: "UP"})
}

func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	checks := make(map[string]string)
	isReady := true

	if h.db != nil {
		if err := h.db.Ping(r.Context()); err != nil {
			checks["database"] = "DOWN"
			isReady = false
		} else {
			checks["database"] = "UP"
		}
	} else {
		checks["database"] = "UNCONFIGURED"
		isReady = false
	}

	if isReady {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(ReadyResponse{
			Status: "UP",
			Checks: checks,
		})
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(ReadyResponse{
			Status: "DOWN",
			Checks: checks,
		})
	}
}
