package closing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

var (
	ErrDatabaseUnavailable  = errors.New("database connection is unavailable")
	ErrFiscalPeriodNotFound = errors.New("fiscal period not found")
	ErrInvalidPeriodStatus  = errors.New("invalid fiscal period status transition")
	ErrYearRequired         = errors.New("fiscal year must be a valid positive year")
)

type FiscalPeriod struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organizationId"`
	FiscalYear     int    `json:"fiscalYear"`
	PeriodNumber   int    `json:"periodNumber"`
	StartDate      string `json:"startDate"`
	EndDate        string `json:"endDate"`
	Status         string `json:"status"` // OPEN, CLOSED, LOCKED
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) getDB(ctx context.Context) middleware.DBTX {
	if s == nil {
		return nil
	}
	if tx, ok := middleware.GetTxFromContext(ctx); ok && tx != nil {
		return tx
	}
	return nil
}

func (s *Service) ListFiscalPeriods(ctx context.Context, orgID string) ([]FiscalPeriod, error) {
	db := s.getDB(ctx)
	if db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT id, organization_id, fiscal_year, period_number, start_date::text, end_date::text, status
		FROM fiscal_periods
		WHERE organization_id = $1
		ORDER BY fiscal_year DESC, period_number ASC;
	`

	rows, err := db.Query(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list fiscal periods: %w", err)
	}
	defer rows.Close()

	var periods []FiscalPeriod
	for rows.Next() {
		var p FiscalPeriod
		if err := rows.Scan(&p.ID, &p.OrganizationID, &p.FiscalYear, &p.PeriodNumber, &p.StartDate, &p.EndDate, &p.Status); err != nil {
			return nil, fmt.Errorf("failed to scan fiscal period row: %w", err)
		}
		periods = append(periods, p)
	}

	if periods == nil {
		periods = []FiscalPeriod{}
	}

	return periods, nil
}

func (s *Service) GenerateFiscalPeriods(ctx context.Context, orgID string, year int) ([]FiscalPeriod, error) {
	if year < 1900 || year > 2100 {
		return nil, ErrYearRequired
	}
	db := s.getDB(ctx)
	if db == nil {
		return nil, ErrDatabaseUnavailable
	}

	var startMonth int = 1
	orgQuery := `SELECT fiscal_year_start_month FROM organizations WHERE id = $1;`
	if err := db.QueryRow(ctx, orgQuery, orgID).Scan(&startMonth); err != nil {
		return nil, fmt.Errorf("failed to fetch organization fiscal settings: %w", err)
	}

	insertQuery := `
		INSERT INTO fiscal_periods (organization_id, fiscal_year, period_number, start_date, end_date, status)
		VALUES ($1, $2, $3, $4::date, $5::date, 'OPEN')
		ON CONFLICT (organization_id, fiscal_year, period_number) 
		DO UPDATE SET status = fiscal_periods.status
		RETURNING id, start_date::text, end_date::text, status;
	`

	var periods []FiscalPeriod
	for periodNum := 1; periodNum <= 12; periodNum++ {
		calcMonth := (startMonth-1+periodNum-1)%12 + 1
		calcYear := year
		if (startMonth - 1 + periodNum - 1) >= 12 {
			calcYear = year + 1
		}

		startDate := time.Date(calcYear, time.Month(calcMonth), 1, 0, 0, 0, 0, time.UTC)
		endDate := startDate.AddDate(0, 1, -1)

		sStr := startDate.Format("2006-01-02")
		eStr := endDate.Format("2006-01-02")

		var p FiscalPeriod
		p.OrganizationID = orgID
		p.FiscalYear = year
		p.PeriodNumber = periodNum

		err := db.QueryRow(ctx, insertQuery, orgID, year, periodNum, sStr, eStr).Scan(&p.ID, &p.StartDate, &p.EndDate, &p.Status)
		if err != nil {
			return nil, fmt.Errorf("failed to insert/update fiscal period %d: %w", periodNum, err)
		}
		periods = append(periods, p)
	}

	return periods, nil
}

func (s *Service) CloseFiscalPeriod(ctx context.Context, orgID string, periodID string, userID string) (*FiscalPeriod, error) {
	return s.updatePeriodStatus(ctx, orgID, periodID, userID, "CLOSED", "CLOSE")
}

func (s *Service) LockFiscalPeriod(ctx context.Context, orgID string, periodID string, userID string) (*FiscalPeriod, error) {
	return s.updatePeriodStatus(ctx, orgID, periodID, userID, "LOCKED", "LOCK")
}

func (s *Service) UnlockFiscalPeriod(ctx context.Context, orgID string, periodID string, userID string) (*FiscalPeriod, error) {
	return s.updatePeriodStatus(ctx, orgID, periodID, userID, "OPEN", "UPDATE")
}

func (s *Service) updatePeriodStatus(ctx context.Context, orgID string, periodID string, userID string, newStatus string, auditAction string) (*FiscalPeriod, error) {
	db := s.getDB(ctx)
	if db == nil {
		return nil, ErrDatabaseUnavailable
	}

	var p FiscalPeriod
	p.ID = periodID
	p.OrganizationID = orgID

	var currentStatus string
	getPeriodQuery := `
		SELECT fiscal_year, period_number, start_date::text, end_date::text, status
		FROM fiscal_periods
		WHERE organization_id = $1 AND id = $2;
	`
	if err := db.QueryRow(ctx, getPeriodQuery, orgID, periodID).Scan(&p.FiscalYear, &p.PeriodNumber, &p.StartDate, &p.EndDate, &currentStatus); err != nil {
		return nil, ErrFiscalPeriodNotFound
	}

	if currentStatus == newStatus {
		p.Status = newStatus
		return &p, nil
	}

	updateQuery := `
		UPDATE fiscal_periods
		SET status = $1
		WHERE organization_id = $2 AND id = $3
		RETURNING status;
	`
	if err := db.QueryRow(ctx, updateQuery, newStatus, orgID, periodID).Scan(&p.Status); err != nil {
		return nil, fmt.Errorf("failed to update fiscal period status: %w", err)
	}

	changesJSON, _ := json.Marshal(map[string]interface{}{
		"period_id":       periodID,
		"fiscal_year":     p.FiscalYear,
		"period_number":   p.PeriodNumber,
		"previous_status": currentStatus,
		"new_status":      newStatus,
	})

	corrID := fmt.Sprintf("period-%s-%s", strings.ToLower(newStatus), periodID[:8])
	auditQuery := `
		INSERT INTO audit_logs (organization_id, actor_id, actor_type, correlation_id, entity_type, entity_id, action, changes)
		VALUES ($1, $2, 'USER', $3, 'FISCAL_PERIOD', $4, $5, $6);
	`
	if _, err := db.Exec(ctx, auditQuery, orgID, userID, corrID, periodID, auditAction, changesJSON); err != nil {
		return nil, fmt.Errorf("failed to record fiscal period audit log: %w", err)
	}

	return &p, nil
}
