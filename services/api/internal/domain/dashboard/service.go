package dashboard

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDatabaseUnavailable = errors.New("database connection is unavailable")
)

type ExpenseCategory struct {
	AccountCode string  `json:"accountCode"`
	AccountName string  `json:"accountName"`
	AmountMinor int64   `json:"amountMinor"`
	Percentage  float64 `json:"percentage"`
}

type DashboardMetrics struct {
	OrganizationID   string            `json:"organizationId"`
	WorkingCapital   int64             `json:"workingCapitalMinorUnits"`
	CashPosition     int64             `json:"cashPositionMinorUnits"`
	MonthlyBurnRate  int64             `json:"monthlyBurnRateMinorUnits"`
	RunwayMonths     float64           `json:"runwayMonths"`
	YtdRevenue       int64             `json:"ytdRevenueMinorUnits"`
	YtdExpense       int64             `json:"ytdExpenseMinorUnits"`
	NetIncome        int64             `json:"netIncomeMinorUnits"`
	ExpenseBreakdown []ExpenseCategory `json:"expenseBreakdown"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) GetDashboardMetrics(ctx context.Context, orgID string) (*DashboardMetrics, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	metrics := &DashboardMetrics{
		OrganizationID:   orgID,
		ExpenseBreakdown: []ExpenseCategory{},
	}

	// 1. Compute totals per account_type
	query := `
		SELECT a.account_type, 
		       COALESCE(SUM(jel.debit_amount_minor_units), 0) as total_debit,
		       COALESCE(SUM(jel.credit_amount_minor_units), 0) as total_credit
		FROM accounts a
		LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id AND a.organization_id = jel.organization_id
		LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'POSTED'
		WHERE a.organization_id = $1 AND a.is_active = true
		GROUP BY a.account_type;
	`
	rows, err := s.db.Query(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to query account balances for dashboard: %w", err)
	}

	var totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpense int64

	for rows.Next() {
		var accType string
		var debit, credit int64
		if err := rows.Scan(&accType, &debit, &credit); err == nil {
			switch accType {
			case "ASSET":
				totalAssets += (debit - credit)
			case "LIABILITY":
				totalLiabilities += (credit - debit)
			case "EQUITY":
				totalEquity += (credit - debit)
			case "REVENUE":
				totalRevenue += (credit - debit)
			case "EXPENSE":
				totalExpense += (debit - credit)
			}
		}
	}
	rows.Close()

	// Working Capital = Assets - Liabilities
	metrics.WorkingCapital = totalAssets - totalLiabilities
	metrics.YtdRevenue = totalRevenue
	metrics.YtdExpense = totalExpense
	metrics.NetIncome = totalRevenue - totalExpense

	// Cash Position: Sum of ASSET accounts with 'cash' or 'bank' in name, or fallback to positive assets
	cashQuery := `
		SELECT COALESCE(SUM(jel.debit_amount_minor_units - jel.credit_amount_minor_units), 0)
		FROM accounts a
		JOIN journal_entry_lines jel ON a.id = jel.account_id
		JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'POSTED'
		WHERE a.organization_id = $1 AND a.account_type = 'ASSET'
		  AND (LOWER(a.name) LIKE '%cash%' OR LOWER(a.name) LIKE '%bank%' OR LOWER(a.name) LIKE '%operating%');
	`
	var cashPos int64
	err = s.db.QueryRow(ctx, cashQuery, orgID).Scan(&cashPos)
	if err == nil && cashPos > 0 {
		metrics.CashPosition = cashPos
	} else if totalAssets > 0 {
		metrics.CashPosition = totalAssets
	}

	// Monthly Burn Rate: Total Expense divided by closed/active periods (or fallback to total expense if <= 1 month)
	var periodCount int64
	_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM fiscal_periods WHERE organization_id = $1 AND status IN ('CLOSED', 'LOCKED');`, orgID).Scan(&periodCount)
	if periodCount < 1 {
		periodCount = 1
	}

	if totalExpense > 0 {
		metrics.MonthlyBurnRate = totalExpense / periodCount
	}

	// Runway Months = Cash Position / Monthly Burn Rate
	if metrics.MonthlyBurnRate > 0 {
		runway := float64(metrics.CashPosition) / float64(metrics.MonthlyBurnRate)
		metrics.RunwayMonths = float64(int(runway*10)) / 10.0 // 1 decimal place
	} else {
		metrics.RunwayMonths = 99.9 // Infinity representation
	}

	// Expense Breakdown per account
	expQuery := `
		SELECT a.account_code, a.name, 
		       COALESCE(SUM(jel.debit_amount_minor_units - jel.credit_amount_minor_units), 0) as amount
		FROM accounts a
		JOIN journal_entry_lines jel ON a.id = jel.account_id
		JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'POSTED'
		WHERE a.organization_id = $1 AND a.account_type = 'EXPENSE'
		GROUP BY a.account_code, a.name
		HAVING SUM(jel.debit_amount_minor_units - jel.credit_amount_minor_units) > 0
		ORDER BY amount DESC;
	`
	expRows, err := s.db.Query(ctx, expQuery, orgID)
	if err == nil {
		for expRows.Next() {
			var code, name string
			var amt int64
			if err := expRows.Scan(&code, &name, &amt); err == nil {
				pct := 0.0
				if totalExpense > 0 {
					pct = float64(amt) / float64(totalExpense) * 100.0
					pct = float64(int(pct*10)) / 10.0
				}
				metrics.ExpenseBreakdown = append(metrics.ExpenseBreakdown, ExpenseCategory{
					AccountCode: code,
					AccountName: name,
					AmountMinor: amt,
					Percentage:  pct,
				})
			}
		}
		expRows.Close()
	}

	return metrics, nil
}
