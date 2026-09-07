package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/export"
)

type ExportHandler struct {
	exportService *export.Service
}

func NewExportHandler(exportService *export.Service) *ExportHandler {
	return &ExportHandler{exportService: exportService}
}

func (h *ExportHandler) ExportGeneralLedgerCSV(w http.ResponseWriter, r *http.Request) {
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

	csvData, err := h.exportService.ExportGeneralLedgerCSV(r.Context(), orgID)
	if err != nil {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://api.finintel.com/errors/internal-error",
			"title":  "Ledger CSV Export Failed",
			"status": 500,
			"detail": err.Error(),
		})
		return
	}

	filename := fmt.Sprintf("finintel_ledger_%s.csv", time.Now().Format("20060102"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(csvData))
}

func (h *ExportHandler) ExportAuditLogsCSV(w http.ResponseWriter, r *http.Request) {
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

	csvData, err := h.exportService.ExportAuditLogsCSV(r.Context(), orgID)
	if err != nil {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://api.finintel.com/errors/internal-error",
			"title":  "Audit Log CSV Export Failed",
			"status": 500,
			"detail": err.Error(),
		})
		return
	}

	filename := fmt.Sprintf("finintel_audit_logs_%s.csv", time.Now().Format("20060102"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(csvData))
}
