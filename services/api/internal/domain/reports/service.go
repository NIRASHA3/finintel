package reports

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDatabaseUnavailable = errors.New("database connection is unavailable")
	ErrInvalidDateRange    = errors.New("start date must be before or equal to end date")
)

type AccountReportLine struct {
	AccountID              string `json:"accountId"`
	AccountCode            string `json:"accountCode"`
	AccountName            string `json:"accountName"`
	AccountType            string `json:"accountType"`
	DebitAmountMinorUnits  int64  `json:"debitAmountMinorUnits"`
	CreditAmountMinorUnits int64  `json:"creditAmountMinorUnits"`
	NetBalanceMinorUnits   int64  `json:"netBalanceMinorUnits"`
}

type TrialBalanceReport struct {
	AsOfDate                string              `json:"asOfDate"`
	Accounts                []AccountReportLine `json:"accounts"`
	TotalDebitsMinorUnits   int64               `json:"totalDebitsMinorUnits"`
	TotalCreditsMinorUnits  int64               `json:"totalCreditsMinorUnits"`
	IsBalanced              bool                `json:"isBalanced"`
}

type IncomeStatementReport struct {
	StartDate                string              `json:"startDate"`
	EndDate                  string              `json:"endDate"`
	RevenueAccounts          []AccountReportLine `json:"revenueAccounts"`
	ExpenseAccounts          []AccountReportLine `json:"expenseAccounts"`
	TotalRevenueMinorUnits   int64               `json:"totalRevenueMinorUnits"`
	TotalExpensesMinorUnits  int64               `json:"totalExpensesMinorUnits"`
	NetIncomeMinorUnits      int64               `json:"netIncomeMinorUnits"`
}

type BalanceSheetReport struct {
	AsOfDate                       string              `json:"asOfDate"`
	AssetAccounts                  []AccountReportLine `json:"assetAccounts"`
	LiabilityAccounts              []AccountReportLine `json:"liabilityAccounts"`
	EquityAccounts                 []AccountReportLine `json:"equityAccounts"`
	TotalAssetsMinorUnits          int64               `json:"totalAssetsMinorUnits"`
	TotalLiabilitiesMinorUnits     int64               `json:"totalLiabilitiesMinorUnits"`
	DirectEquityMinorUnits         int64               `json:"directEquityMinorUnits"`
	RetainedEarningsMinorUnits     int64               `json:"retainedEarningsMinorUnits"`
	TotalEquityMinorUnits          int64               `json:"totalEquityMinorUnits"`
	TotalLiabilitiesAndEquityMinor int64               `json:"totalLiabilitiesAndEquityMinorUnits"`
	IsBalanced                     bool                `json:"isBalanced"`
	EquationDeltaMinorUnits        int64               `json:"equationDeltaMinorUnits"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// GetTrialBalance aggregates total debits and credits for all active/used accounts as of a target date.
func (s *Service) GetTrialBalance(ctx context.Context, orgID string, asOfDate string) (*TrialBalanceReport, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	date := strings.TrimSpace(asOfDate)
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}

	query := `
		SELECT 
			a.id, 
			a.account_code, 
			a.name, 
			a.account_type,
			COALESCE(SUM(jel.debit_amount_minor_units), 0) AS total_debit,
			COALESCE(SUM(jel.credit_amount_minor_units), 0) AS total_credit
		FROM accounts a
		LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id AND jel.organization_id = a.organization_id
		LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.organization_id = a.organization_id
		WHERE a.organization_id = $1
		  AND (je.id IS NULL OR (je.status = 'POSTED' AND je.transaction_date <= $2::date))
		GROUP BY a.id, a.account_code, a.name, a.account_type
		ORDER BY a.account_code ASC;
	`

	rows, err := s.db.Query(ctx, query, orgID, date)
	if err != nil {
		return nil, fmt.Errorf("failed to query trial balance: %w", err)
	}
	defer rows.Close()

	var report TrialBalanceReport
	report.AsOfDate = date
	report.Accounts = []AccountReportLine{}

	for rows.Next() {
		var line AccountReportLine
		if err := rows.Scan(&line.AccountID, &line.AccountCode, &line.AccountName, &line.AccountType, &line.DebitAmountMinorUnits, &line.CreditAmountMinorUnits); err != nil {
			return nil, fmt.Errorf("failed to scan trial balance row: %w", err)
		}

		if line.AccountType == "ASSET" || line.AccountType == "EXPENSE" {
			line.NetBalanceMinorUnits = line.DebitAmountMinorUnits - line.CreditAmountMinorUnits
		} else {
			line.NetBalanceMinorUnits = line.CreditAmountMinorUnits - line.DebitAmountMinorUnits
		}

		report.TotalDebitsMinorUnits += line.DebitAmountMinorUnits
		report.TotalCreditsMinorUnits += line.CreditAmountMinorUnits
		report.Accounts = append(report.Accounts, line)
	}

	report.IsBalanced = (report.TotalDebitsMinorUnits == report.TotalCreditsMinorUnits)
	return &report, nil
}

// GetIncomeStatement aggregates revenues and expenses between startDate and endDate.
func (s *Service) GetIncomeStatement(ctx context.Context, orgID string, startDate string, endDate string) (*IncomeStatementReport, error) {
	sDate := strings.TrimSpace(startDate)
	eDate := strings.TrimSpace(endDate)

	if eDate == "" {
		eDate = time.Now().UTC().Format("2006-01-02")
	}
	if sDate == "" {
		// Default to first day of current year
		sDate = time.Now().UTC().Format("2006") + "-01-01"
	}

	if sDate > eDate {
		return nil, ErrInvalidDateRange
	}

	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT 
			a.id, 
			a.account_code, 
			a.name, 
			a.account_type,
			COALESCE(SUM(jel.debit_amount_minor_units), 0) AS total_debit,
			COALESCE(SUM(jel.credit_amount_minor_units), 0) AS total_credit
		FROM accounts a
		JOIN journal_entry_lines jel ON jel.account_id = a.id AND jel.organization_id = a.organization_id
		JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.organization_id = a.organization_id
		WHERE a.organization_id = $1
		  AND a.account_type IN ('REVENUE', 'EXPENSE')
		  AND je.status = 'POSTED'
		  AND je.transaction_date >= $2::date
		  AND je.transaction_date <= $3::date
		GROUP BY a.id, a.account_code, a.name, a.account_type
		ORDER BY a.account_code ASC;
	`

	rows, err := s.db.Query(ctx, query, orgID, sDate, eDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query income statement: %w", err)
	}
	defer rows.Close()

	var report IncomeStatementReport
	report.StartDate = sDate
	report.EndDate = eDate
	report.RevenueAccounts = []AccountReportLine{}
	report.ExpenseAccounts = []AccountReportLine{}

	for rows.Next() {
		var line AccountReportLine
		if err := rows.Scan(&line.AccountID, &line.AccountCode, &line.AccountName, &line.AccountType, &line.DebitAmountMinorUnits, &line.CreditAmountMinorUnits); err != nil {
			return nil, fmt.Errorf("failed to scan income statement row: %w", err)
		}

		if line.AccountType == "REVENUE" {
			line.NetBalanceMinorUnits = line.CreditAmountMinorUnits - line.DebitAmountMinorUnits
			report.TotalRevenueMinorUnits += line.NetBalanceMinorUnits
			report.RevenueAccounts = append(report.RevenueAccounts, line)
		} else if line.AccountType == "EXPENSE" {
			line.NetBalanceMinorUnits = line.DebitAmountMinorUnits - line.CreditAmountMinorUnits
			report.TotalExpensesMinorUnits += line.NetBalanceMinorUnits
			report.ExpenseAccounts = append(report.ExpenseAccounts, line)
		}
	}

	report.NetIncomeMinorUnits = report.TotalRevenueMinorUnits - report.TotalExpensesMinorUnits
	return &report, nil
}

// GetBalanceSheet calculates Assets, Liabilities, and Equity as of asOfDate with the Balance Sheet Equation Safeguard.
func (s *Service) GetBalanceSheet(ctx context.Context, orgID string, asOfDate string) (*BalanceSheetReport, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	date := strings.TrimSpace(asOfDate)
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}

	query := `
		SELECT 
			a.id, 
			a.account_code, 
			a.name, 
			a.account_type,
			COALESCE(SUM(jel.debit_amount_minor_units), 0) AS total_debit,
			COALESCE(SUM(jel.credit_amount_minor_units), 0) AS total_credit
		FROM accounts a
		LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id AND jel.organization_id = a.organization_id
		LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.organization_id = a.organization_id
		WHERE a.organization_id = $1
		  AND (je.id IS NULL OR (je.status = 'POSTED' AND je.transaction_date <= $2::date))
		GROUP BY a.id, a.account_code, a.name, a.account_type
		ORDER BY a.account_code ASC;
	`

	rows, err := s.db.Query(ctx, query, orgID, date)
	if err != nil {
		return nil, fmt.Errorf("failed to query balance sheet: %w", err)
	}
	defer rows.Close()

	var report BalanceSheetReport
	report.AsOfDate = date
	report.AssetAccounts = []AccountReportLine{}
	report.LiabilityAccounts = []AccountReportLine{}
	report.EquityAccounts = []AccountReportLine{}

	var cumRevenue int64 = 0
	var cumExpenses int64 = 0

	for rows.Next() {
		var line AccountReportLine
		if err := rows.Scan(&line.AccountID, &line.AccountCode, &line.AccountName, &line.AccountType, &line.DebitAmountMinorUnits, &line.CreditAmountMinorUnits); err != nil {
			return nil, fmt.Errorf("failed to scan balance sheet row: %w", err)
		}

		switch line.AccountType {
		case "ASSET":
			line.NetBalanceMinorUnits = line.DebitAmountMinorUnits - line.CreditAmountMinorUnits
			report.TotalAssetsMinorUnits += line.NetBalanceMinorUnits
			report.AssetAccounts = append(report.AssetAccounts, line)

		case "LIABILITY":
			line.NetBalanceMinorUnits = line.CreditAmountMinorUnits - line.DebitAmountMinorUnits
			report.TotalLiabilitiesMinorUnits += line.NetBalanceMinorUnits
			report.LiabilityAccounts = append(report.LiabilityAccounts, line)

		case "EQUITY":
			line.NetBalanceMinorUnits = line.CreditAmountMinorUnits - line.DebitAmountMinorUnits
			report.DirectEquityMinorUnits += line.NetBalanceMinorUnits
			report.EquityAccounts = append(report.EquityAccounts, line)

		case "REVENUE":
			netRev := line.CreditAmountMinorUnits - line.DebitAmountMinorUnits
			cumRevenue += netRev

		case "EXPENSE":
			netExp := line.DebitAmountMinorUnits - line.CreditAmountMinorUnits
			cumExpenses += netExp
		}
	}

	report.RetainedEarningsMinorUnits = cumRevenue - cumExpenses
	report.TotalEquityMinorUnits = report.DirectEquityMinorUnits + report.RetainedEarningsMinorUnits
	report.TotalLiabilitiesAndEquityMinor = report.TotalLiabilitiesMinorUnits + report.TotalEquityMinorUnits

	// BALANCE SHEET EQUATION SAFEGUARD: Assets = Liabilities + Equity
	report.EquationDeltaMinorUnits = report.TotalAssetsMinorUnits - report.TotalLiabilitiesAndEquityMinor
	report.IsBalanced = (report.EquationDeltaMinorUnits == 0)

	return &report, nil
}
