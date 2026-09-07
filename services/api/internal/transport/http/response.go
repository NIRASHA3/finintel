package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   code,
		"message": message,
	})
}

func getOrgIDFromRequest(r *http.Request) string {
	orgID := chi.URLParam(r, "organizationId")
	if orgID == "" {
		orgID = chi.URLParam(r, "id")
	}
	if orgID == "" {
		orgID = r.Header.Get("X-Organization-ID")
	}
	if orgID == "" {
		orgID = "00000000-0000-0000-0000-000000000001"
	}
	return orgID
}
