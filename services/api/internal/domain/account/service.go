package account

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidAccountCode   = errors.New("account code is required and must be alphanumeric (1-50 characters)")
	ErrInvalidAccountName   = errors.New("account name is required (at least 2 characters)")
	ErrInvalidAccountType   = errors.New("account type must be ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE")
	ErrAccountAlreadyExists = errors.New("account code already exists in this organization")
	ErrDatabaseUnavailable  = errors.New("database connection is unavailable")
)

type AccountType string

const (
	TypeAsset     AccountType = "ASSET"
	TypeLiability AccountType = "LIABILITY"
	TypeEquity    AccountType = "EQUITY"
	TypeRevenue   AccountType = "REVENUE"
	TypeExpense   AccountType = "EXPENSE"
)

type Account struct {
	ID             string      `json:"id"`
	OrganizationID string      `json:"organizationId"`
	AccountCode    string      `json:"accountCode"`
	Name           string      `json:"name"`
	AccountType    AccountType `json:"accountType"`
	IsActive       bool        `json:"isActive"`
}

type CreateAccountParams struct {
	AccountCode string      `json:"accountCode"`
	Name        string      `json:"name"`
	AccountType AccountType `json:"accountType"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) SeedDefaultAccounts(ctx context.Context, orgID string) ([]Account, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	defaultAccounts := []CreateAccountParams{
		{AccountCode: "1010", Name: "Cash & Operating Checking", AccountType: TypeAsset},
		{AccountCode: "1100", Name: "Accounts Receivable", AccountType: TypeAsset},
		{AccountCode: "1200", Name: "Prepaid Software & Subscriptions", AccountType: TypeAsset},
		{AccountCode: "2010", Name: "Accounts Payable", AccountType: TypeLiability},
		{AccountCode: "2100", Name: "Accrued Salaries & Payroll Liabilities", AccountType: TypeLiability},
		{AccountCode: "3010", Name: "Retained Earnings", AccountType: TypeEquity},
		{AccountCode: "3020", Name: "Owner's Equity & Common Stock", AccountType: TypeEquity},
		{AccountCode: "4010", Name: "Subscription SaaS Revenue", AccountType: TypeRevenue},
		{AccountCode: "4020", Name: "Professional Services & Advisory Revenue", AccountType: TypeRevenue},
		{AccountCode: "5010", Name: "Salaries & Employee Wages Expense", AccountType: TypeExpense},
		{AccountCode: "5020", Name: "Cloud Infrastructure & Hosting Expense", AccountType: TypeExpense},
		{AccountCode: "5030", Name: "Sales & Digital Marketing Expense", AccountType: TypeExpense},
		{AccountCode: "5040", Name: "Office Rent & Utilities Expense", AccountType: TypeExpense},
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start seeding transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	query := `
		INSERT INTO accounts (organization_id, account_code, name, account_type, is_active)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (organization_id, account_code) DO NOTHING;
	`
	for _, acc := range defaultAccounts {
		_, err := tx.Exec(ctx, query, orgID, acc.AccountCode, acc.Name, string(acc.AccountType))
		if err != nil {
			return nil, fmt.Errorf("failed to seed account %s: %w", acc.AccountCode, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit account seeding: %w", err)
	}

	return s.ListAccounts(ctx, orgID)
}

func (s *Service) CreateAccount(ctx context.Context, orgID string, params CreateAccountParams) (*Account, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	code := strings.TrimSpace(params.AccountCode)
	if len(code) < 1 || len(code) > 50 {
		return nil, ErrInvalidAccountCode
	}

	name := strings.TrimSpace(params.Name)
	if len(name) < 2 {
		return nil, ErrInvalidAccountName
	}

	accType := AccountType(strings.ToUpper(strings.TrimSpace(string(params.AccountType))))
	switch accType {
	case TypeAsset, TypeLiability, TypeEquity, TypeRevenue, TypeExpense:
	default:
		return nil, ErrInvalidAccountType
	}

	query := `
		INSERT INTO accounts (organization_id, account_code, name, account_type, is_active)
		VALUES ($1, $2, $3, $4, true)
		RETURNING id, organization_id, account_code, name, account_type, is_active;
	`
	var acc Account
	err := s.db.QueryRow(ctx, query, orgID, code, name, string(accType)).Scan(
		&acc.ID, &acc.OrganizationID, &acc.AccountCode, &acc.Name, &acc.AccountType, &acc.IsActive,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "uk_accounts_org_code") {
			return nil, ErrAccountAlreadyExists
		}
		return nil, fmt.Errorf("failed to insert account: %w", err)
	}

	return &acc, nil
}

func (s *Service) ListAccounts(ctx context.Context, orgID string) ([]Account, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT id, organization_id, account_code, name, account_type, is_active
		FROM accounts
		WHERE organization_id = $1
		ORDER BY account_code ASC;
	`
	rows, err := s.db.Query(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to query accounts: %w", err)
	}
	defer rows.Close()

	var accounts []Account
	for rows.Next() {
		var acc Account
		if err := rows.Scan(&acc.ID, &acc.OrganizationID, &acc.AccountCode, &acc.Name, &acc.AccountType, &acc.IsActive); err != nil {
			return nil, fmt.Errorf("failed to scan account row: %w", err)
		}
		accounts = append(accounts, acc)
	}

	if accounts == nil {
		accounts = []Account{}
	}

	return accounts, nil
}

// Silence unused pgx error import if needed
var _ = pgx.ErrNoRows
