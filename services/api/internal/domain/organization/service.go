package organization

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NIRASHA3/finintel/services/api/internal/transport/http/middleware"
)

var (
	ErrInvalidName         = errors.New("organization name must be at least 2 characters")
	ErrOrganizationFound   = errors.New("organization not found")
	ErrUnauthorized        = errors.New("unauthorized access to organization")
	ErrDatabaseUnavailable = errors.New("database connection is unavailable")
)

type Organization struct {
	ID                   string    `json:"id"`
	Name                 string    `json:"name"`
	BaseCurrency         string    `json:"baseCurrency"`
	FiscalYearStartMonth int       `json:"fiscalYearStartMonth"`
	Role                 string    `json:"role,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
}

type CreateOrganizationParams struct {
	Name                 string `json:"name"`
	BaseCurrency         string `json:"baseCurrency"`
	FiscalYearStartMonth int    `json:"fiscalYearStartMonth"`
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

func (s *Service) CreateOrganization(ctx context.Context, userID string, correlationID string, params CreateOrganizationParams) (*Organization, error) {
	name := strings.TrimSpace(params.Name)
	if len(name) < 2 {
		return nil, ErrInvalidName
	}

	baseCurrency := strings.ToUpper(strings.TrimSpace(params.BaseCurrency))
	if baseCurrency == "" {
		baseCurrency = "USD"
	}

	fiscalMonth := params.FiscalYearStartMonth
	if fiscalMonth < 1 || fiscalMonth > 12 {
		fiscalMonth = 1
	}

	if correlationID == "" {
		correlationID = "req-create-org"
	}

	db := s.getDB(ctx)
	if db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT id, name, base_currency, fiscal_year_start_month, created_at
		FROM public.fn_create_organization_with_owner($1, $2, $3, $4);
	`
	var org Organization
	org.Role = "OWNER"

	err := db.QueryRow(ctx, query, name, baseCurrency, fiscalMonth, correlationID).Scan(
		&org.ID, &org.Name, &org.BaseCurrency, &org.FiscalYearStartMonth, &org.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to execute fn_create_organization_with_owner: %w", err)
	}

	return &org, nil
}

func (s *Service) ListOrganizationsForUser(ctx context.Context, userID string) ([]Organization, error) {
	db := s.getDB(ctx)
	if db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT o.id, o.name, o.base_currency, o.fiscal_year_start_month, m.role, o.created_at
		FROM public.organizations o
		JOIN public.organization_memberships m ON o.id = m.organization_id
		WHERE m.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
		ORDER BY o.created_at DESC;
	`
	rows, err := db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query user organizations: %w", err)
	}
	defer rows.Close()

	var result []Organization
	for rows.Next() {
		var o Organization
		if err := rows.Scan(&o.ID, &o.Name, &o.BaseCurrency, &o.FiscalYearStartMonth, &o.Role, &o.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan organization row: %w", err)
		}
		result = append(result, o)
	}

	if result == nil {
		result = []Organization{}
	}

	return result, nil
}

func (s *Service) GetOrganizationByID(ctx context.Context, orgID string, userID string) (*Organization, error) {
	db := s.getDB(ctx)
	if db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT o.id, o.name, o.base_currency, o.fiscal_year_start_month, m.role, o.created_at
		FROM public.organizations o
		JOIN public.organization_memberships m ON o.id = m.organization_id
		WHERE o.id = $1 AND m.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid;
	`
	var o Organization
	err := db.QueryRow(ctx, query, orgID).Scan(&o.ID, &o.Name, &o.BaseCurrency, &o.FiscalYearStartMonth, &o.Role, &o.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrOrganizationFound
		}
		return nil, fmt.Errorf("failed to fetch organization: %w", err)
	}

	return &o, nil
}
