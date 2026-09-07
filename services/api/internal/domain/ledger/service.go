package ledger

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
	ErrInvalidEntryLines      = errors.New("journal entry must contain at least 2 entry lines")
	ErrInvalidLineAmount      = errors.New("entry line amounts must be non-negative integer minor units and specify either debit or credit, not both")
	ErrUnbalancedJournalEntry = errors.New("unbalanced journal entry: total debits must equal total credits")
	ErrInvalidTransactionDate = errors.New("transaction date is required")
	ErrDescriptionRequired    = errors.New("transaction description is required (at least 3 characters)")
	ErrAccountNotFound        = errors.New("one or more target accounts do not exist in this organization or are inactive")
	ErrFiscalPeriodLocked     = errors.New("cannot post journal entry into a closed or locked fiscal period")
	ErrDatabaseUnavailable    = errors.New("database connection is unavailable")
)

type JournalEntryLineRequest struct {
	AccountID              string `json:"accountId"`
	DebitAmountMinorUnits  int64  `json:"debitAmountMinorUnits"`
	CreditAmountMinorUnits int64  `json:"creditAmountMinorUnits"`
	Memo                   string `json:"memo,omitempty"`
}

type CreateJournalEntryParams struct {
	TransactionDate string                    `json:"transactionDate"` // YYYY-MM-DD
	Description     string                    `json:"description"`
	Lines           []JournalEntryLineRequest `json:"lines"`
}

type JournalEntryLine struct {
	ID                     string `json:"id"`
	OrganizationID         string `json:"organizationId"`
	JournalEntryID         string `json:"journalEntryId"`
	AccountID              string `json:"accountId"`
	AccountCode            string `json:"accountCode,omitempty"`
	AccountName            string `json:"accountName,omitempty"`
	DebitAmountMinorUnits  int64  `json:"debitAmountMinorUnits"`
	CreditAmountMinorUnits int64  `json:"creditAmountMinorUnits"`
	Memo                   string `json:"memo,omitempty"`
}

type JournalEntry struct {
	ID                string             `json:"id"`
	OrganizationID    string             `json:"organizationId"`
	EntryNumber       int64              `json:"entryNumber"`
	TransactionDate   string             `json:"transactionDate"`
	Description       string             `json:"description"`
	Status            string             `json:"status"` // POSTED
	ReversedByEntryID string             `json:"reversedByEntryId,omitempty"`
	PostedByUserID    string             `json:"postedByUserId,omitempty"`
	CreatedAt         time.Time          `json:"createdAt"`
	Lines             []JournalEntryLine `json:"lines"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) PostJournalEntry(ctx context.Context, orgID string, userID string, correlationID string, params CreateJournalEntryParams) (*JournalEntry, error) {
	description := strings.TrimSpace(params.Description)
	if len(description) < 3 {
		return nil, ErrDescriptionRequired
	}

	txDate := strings.TrimSpace(params.TransactionDate)
	if txDate == "" {
		txDate = time.Now().UTC().Format("2006-01-02")
	}

	if len(params.Lines) < 2 {
		return nil, ErrInvalidEntryLines
	}

	var totalDebit int64 = 0
	var totalCredit int64 = 0

	for _, line := range params.Lines {
		if line.DebitAmountMinorUnits < 0 || line.CreditAmountMinorUnits < 0 {
			return nil, ErrInvalidLineAmount
		}

		// XOR check: line must be either debit > 0 or credit > 0, never both, never neither
		isDebit := line.DebitAmountMinorUnits > 0 && line.CreditAmountMinorUnits == 0
		isCredit := line.CreditAmountMinorUnits > 0 && line.DebitAmountMinorUnits == 0

		if !isDebit && !isCredit {
			return nil, ErrInvalidLineAmount
		}

		totalDebit += line.DebitAmountMinorUnits
		totalCredit += line.CreditAmountMinorUnits
	}

	// STRICT DOUBLE-ENTRY EQUALITY INVARIANT: sum(Debits) MUST EQUAL sum(Credits)
	if totalDebit != totalCredit {
		return nil, fmt.Errorf("%w: total debits (%d) must equal total credits (%d)", ErrUnbalancedJournalEntry, totalDebit, totalCredit)
	}

	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start posting transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// 0. FISCAL PERIOD LOCK SAFEGUARD: Verify period for transaction date is open
	var periodStatus string
	periodCheckQuery := `
		SELECT status 
		FROM fiscal_periods 
		WHERE organization_id = $1 AND start_date <= $2::date AND end_date >= $2::date;
	`
	err = tx.QueryRow(ctx, periodCheckQuery, orgID, txDate).Scan(&periodStatus)
	if err == nil {
		if periodStatus == "CLOSED" || periodStatus == "LOCKED" {
			return nil, fmt.Errorf("%w: period for date %s is %s", ErrFiscalPeriodLocked, txDate, periodStatus)
		}
	}

	// 1. Verify target accounts exist and belong to this organization
	for _, line := range params.Lines {
		var exists bool
		accQuery := `SELECT EXISTS(SELECT 1 FROM accounts WHERE organization_id = $1 AND id = $2 AND is_active = true);`
		if err := tx.QueryRow(ctx, accQuery, orgID, line.AccountID).Scan(&exists); err != nil || !exists {
			return nil, fmt.Errorf("%w: account ID %s", ErrAccountNotFound, line.AccountID)
		}
	}

	// 2. Monotonically generate entry number per organization
	var nextEntryNum int64
	numQuery := `SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries WHERE organization_id = $1;`
	if err := tx.QueryRow(ctx, numQuery, orgID).Scan(&nextEntryNum); err != nil {
		return nil, fmt.Errorf("failed to generate journal entry number: %w", err)
	}

	// 3. Insert journal_entry with status POSTED
	var entry JournalEntry
	entry.OrganizationID = orgID
	entry.EntryNumber = nextEntryNum
	entry.TransactionDate = txDate
	entry.Description = description
	entry.Status = "POSTED"
	entry.PostedByUserID = userID

	insertEntryQuery := `
		INSERT INTO journal_entries (organization_id, entry_number, transaction_date, description, status, posted_by_user_id)
		VALUES ($1, $2, $3::date, $4, 'POSTED', $5)
		RETURNING id, created_at;
	`
	if err := tx.QueryRow(ctx, insertEntryQuery, orgID, nextEntryNum, txDate, description, userID).Scan(&entry.ID, &entry.CreatedAt); err != nil {
		return nil, fmt.Errorf("failed to insert journal entry: %w", err)
	}

	// 4. Insert entry lines
	insertLineQuery := `
		INSERT INTO journal_entry_lines (organization_id, journal_entry_id, account_id, debit_amount_minor_units, credit_amount_minor_units, memo)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id;
	`
	for _, lReq := range params.Lines {
		var lineObj JournalEntryLine
		lineObj.OrganizationID = orgID
		lineObj.JournalEntryID = entry.ID
		lineObj.AccountID = lReq.AccountID
		lineObj.DebitAmountMinorUnits = lReq.DebitAmountMinorUnits
		lineObj.CreditAmountMinorUnits = lReq.CreditAmountMinorUnits
		lineObj.Memo = lReq.Memo

		err := tx.QueryRow(ctx, insertLineQuery, orgID, entry.ID, lReq.AccountID, lReq.DebitAmountMinorUnits, lReq.CreditAmountMinorUnits, lReq.Memo).Scan(&lineObj.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to insert journal entry line: %w", err)
		}
		entry.Lines = append(entry.Lines, lineObj)
	}

	// 5. Insert atomic audit log record
	if correlationID == "" {
		correlationID = fmt.Sprintf("je-post-%d", nextEntryNum)
	}
	changesJSON, _ := json.Marshal(map[string]interface{}{
		"entry_number":     nextEntryNum,
		"transaction_date": txDate,
		"description":      description,
		"total_debits":     totalDebit,
		"total_credits":    totalCredit,
		"lines_count":      len(params.Lines),
	})

	insertAuditQuery := `
		INSERT INTO audit_logs (organization_id, actor_id, actor_type, correlation_id, entity_type, entity_id, action, changes)
		VALUES ($1, $2, 'USER', $3, 'JOURNAL_ENTRY', $4, 'POST', $5);
	`
	if _, err := tx.Exec(ctx, insertAuditQuery, orgID, userID, correlationID, entry.ID, changesJSON); err != nil {
		return nil, fmt.Errorf("failed to record journal posting audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit journal posting transaction: %w", err)
	}

	return &entry, nil
}

func (s *Service) ListJournalEntries(ctx context.Context, orgID string) ([]JournalEntry, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	entriesQuery := `
		SELECT id, organization_id, entry_number, transaction_date::text, description, status, COALESCE(reversed_by_entry_id::text, ''), COALESCE(posted_by_user_id::text, ''), created_at
		FROM journal_entries
		WHERE organization_id = $1
		ORDER BY entry_number DESC;
	`
	rows, err := s.db.Query(ctx, entriesQuery, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to query journal entries: %w", err)
	}
	defer rows.Close()

	var entries []JournalEntry
	for rows.Next() {
		var e JournalEntry
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.EntryNumber, &e.TransactionDate, &e.Description, &e.Status, &e.ReversedByEntryID, &e.PostedByUserID, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan journal entry row: %w", err)
		}

		// Fetch entry lines for each entry
		linesQuery := `
			SELECT jel.id, jel.organization_id, jel.journal_entry_id, jel.account_id, a.account_code, a.name, jel.debit_amount_minor_units, jel.credit_amount_minor_units, COALESCE(jel.memo, '')
			FROM journal_entry_lines jel
			JOIN accounts a ON jel.account_id = a.id
			WHERE jel.organization_id = $1 AND jel.journal_entry_id = $2;
		`
		lRows, err := s.db.Query(ctx, linesQuery, orgID, e.ID)
		if err == nil {
			for lRows.Next() {
				var l JournalEntryLine
				if err := lRows.Scan(&l.ID, &l.OrganizationID, &l.JournalEntryID, &l.AccountID, &l.AccountCode, &l.AccountName, &l.DebitAmountMinorUnits, &l.CreditAmountMinorUnits, &l.Memo); err == nil {
					e.Lines = append(e.Lines, l)
				}
			}
			lRows.Close()
		}
		if e.Lines == nil {
			e.Lines = []JournalEntryLine{}
		}

		entries = append(entries, e)
	}

	if entries == nil {
		entries = []JournalEntry{}
	}

	return entries, nil
}

func (s *Service) GetJournalEntryByID(ctx context.Context, orgID string, entryID string) (*JournalEntry, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		SELECT id, organization_id, entry_number, transaction_date::text, description, status, COALESCE(reversed_by_entry_id::text, ''), COALESCE(posted_by_user_id::text, ''), created_at
		FROM journal_entries
		WHERE organization_id = $1 AND id = $2;
	`
	var e JournalEntry
	err := s.db.QueryRow(ctx, query, orgID, entryID).Scan(&e.ID, &e.OrganizationID, &e.EntryNumber, &e.TransactionDate, &e.Description, &e.Status, &e.ReversedByEntryID, &e.PostedByUserID, &e.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("journal entry not found")
		}
		return nil, fmt.Errorf("failed to fetch journal entry: %w", err)
	}

	linesQuery := `
		SELECT jel.id, jel.organization_id, jel.journal_entry_id, jel.account_id, a.account_code, a.name, jel.debit_amount_minor_units, jel.credit_amount_minor_units, COALESCE(jel.memo, '')
		FROM journal_entry_lines jel
		JOIN accounts a ON jel.account_id = a.id
		WHERE jel.organization_id = $1 AND jel.journal_entry_id = $2;
	`
	lRows, err := s.db.Query(ctx, linesQuery, orgID, e.ID)
	if err == nil {
		for lRows.Next() {
			var l JournalEntryLine
			if err := lRows.Scan(&l.ID, &l.OrganizationID, &l.JournalEntryID, &l.AccountID, &l.AccountCode, &l.AccountName, &l.DebitAmountMinorUnits, &l.CreditAmountMinorUnits, &l.Memo); err == nil {
				e.Lines = append(e.Lines, l)
			}
		}
		lRows.Close()
	}
	if e.Lines == nil {
		e.Lines = []JournalEntryLine{}
	}

	return &e, nil
}
