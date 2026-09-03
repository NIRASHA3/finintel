package organization

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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
	Role                 string    `json:"role"`
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

	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var org Organization
	org.Role = "OWNER"

	// 1. Insert organization
	insertOrgQuery := `
		INSERT INTO organizations (name, base_currency, fiscal_year_start_month)
		VALUES ($1, $2, $3)
		RETURNING id, name, base_currency, fiscal_year_start_month, created_at;
	`
	err = tx.QueryRow(ctx, insertOrgQuery, name, baseCurrency, fiscalMonth).Scan(
		&org.ID, &org.Name, &org.BaseCurrency, &org.FiscalYearStartMonth, &org.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert organization: %w", err)
	}

	// 2. Insert membership (OWNER)
	insertMemberQuery := `
		INSERT INTO organization_memberships (organization_id, user_id, role)
		VALUES ($1, $2, 'OWNER');
	`
	_, err = tx.Exec(ctx, insertMemberQuery, org.ID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert organization membership: %w", err)
	}

	// 3. Insert audit log atomically in same transaction
	if correlationID == "" {
		correlationID = "sys-onboarding-" + org.ID[:8]
	}
	changesJSON, _ := json.Marshal(map[string]interface{}{
		"name":                 org.Name,
		"base_currency":        org.BaseCurrency,
		"fiscal_start_month":   org.FiscalYearStartMonth,
		"initial_owner_userID": userID,
	})

	insertAuditQuery := `
		INSERT INTO audit_logs (organization_id, actor_id, actor_type, correlation_id, entity_type, entity_id, action, changes)
		VALUES ($1, $2, 'USER', $3, 'ORGANIZATION', $1, 'CREATE', $4);
	`
	_, err = tx.Exec(ctx, insertAuditQuery, org.ID, userID, correlationID, changesJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to record organization audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit organization transaction: %w", err)
	}

	return &org, nil
}

func (s *Service) ListOrganizationsForUser(ctx context.Context, userID string) ([]Organization, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT o.id, o.name, o.base_currency, o.fiscal_year_start_month, m.role, o.created_at
		FROM organizations o
		JOIN organization_memberships m ON o.id = m.organization_id
		WHERE m.user_id = $1
		ORDER BY o.created_at DESC;
	`
	rows, err := s.db.Query(ctx, query, userID)
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
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT o.id, o.name, o.base_currency, o.fiscal_year_start_month, m.role, o.created_at
		FROM organizations o
		JOIN organization_memberships m ON o.id = m.organization_id
		WHERE o.id = $1 AND m.user_id = $2;
	`
	var o Organization
	err := s.db.QueryRow(ctx, query, orgID, userID).Scan(&o.ID, &o.Name, &o.BaseCurrency, &o.FiscalYearStartMonth, &o.Role, &o.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrOrganizationFound
		}
		return nil, fmt.Errorf("failed to fetch organization: %w", err)
	}

	return &o, nil
}
