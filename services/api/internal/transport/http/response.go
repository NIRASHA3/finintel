package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
	return chi.URLParam(r, "organizationId")
}

func writeSanitizedDbError(w http.ResponseWriter, err error, fallbackCode string, fallbackMsg string) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "42501":
			writeError(w, http.StatusForbidden, "PERMISSION_DENIED", "Access denied for requested operation")
			return
		case "23505":
			writeError(w, http.StatusConflict, "RESOURCE_CONFLICT", "Resource already exists")
			return
		case "23503":
			writeError(w, http.StatusConflict, "FOREIGN_KEY_VIOLATION", "Referenced entity invalid or not found")
			return
		case "23514":
			writeError(w, http.StatusBadRequest, "CONSTRAINT_VIOLATION", "Operation violates domain validation constraints")
			return
		case "22023":
			writeError(w, http.StatusBadRequest, "INVALID_INPUT", "Invalid input parameters provided")
			return
		case "P0002":
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Requested record not found")
			return
		case "42000", "42001":
			writeError(w, http.StatusForbidden, "TENANT_MISMATCH", "Tenant or session context mismatch")
			return
		}
	}
	writeError(w, http.StatusInternalServerError, fallbackCode, fallbackMsg)
}
