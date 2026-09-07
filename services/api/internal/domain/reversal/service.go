package reversal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NIRASHA3/finintel/services/api/internal/domain/ledger"
)

var (
	ErrEntryNotFound        = errors.New("target journal entry not found")
	ErrEntryNotPosted       = errors.New("only posted journal entries can be reversed")
	ErrAlreadyReversed      = errors.New("this journal entry has already been reversed")
	ErrFiscalPeriodLocked   = errors.New("cannot reverse entry into a closed or locked fiscal period")
	ErrReasonRequired       = errors.New("a valid reason for reversal is required (at least 3 characters)")
	ErrDatabaseUnavailable  = errors.New("database connection is unavailable")
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type ReversalParams struct {
	Reason string `json:"reason"`
}

func (s *Service) PostReversalEntry(ctx context.Context, orgID string, entryID string, userID string, correlationID string, reason string) (*ledger.JournalEntry, error) {
	reason = strings.TrimSpace(reason)
	if len(reason) < 3 {
		return nil, ErrReasonRequired
	}

	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start reversal transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// 1. Fetch target entry
	var targetNum int64
	var targetTxDate, targetDesc, targetStatus string
	var targetReversedBy *string

	targetQuery := `
		SELECT entry_number, transaction_date::text, description, status, reversed_by_entry_id::text
		FROM journal_entries
		WHERE organization_id = $1 AND id = $2;
	`
	err = tx.QueryRow(ctx, targetQuery, orgID, entryID).Scan(&targetNum, &targetTxDate, &targetDesc, &targetStatus, &targetReversedBy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrEntryNotFound
		}
		return nil, fmt.Errorf("failed to fetch target journal entry: %w", err)
	}

	if targetStatus != "POSTED" {
		return nil, ErrEntryNotPosted
	}
	if targetReversedBy != nil && *targetReversedBy != "" {
		return nil, ErrAlreadyReversed
	}

	reversalTxDate := time.Now().UTC().Format("2006-01-02")

	// 2. Check fiscal period for reversal date
	var periodStatus string
	periodCheckQuery := `
		SELECT status 
		FROM fiscal_periods 
		WHERE organization_id = $1 AND start_date <= $2::date AND end_date >= $2::date;
	`
	err = tx.QueryRow(ctx, periodCheckQuery, orgID, reversalTxDate).Scan(&periodStatus)
	if err == nil {
		if periodStatus == "CLOSED" || periodStatus == "LOCKED" {
			return nil, fmt.Errorf("%w: period for date %s is %s", ErrFiscalPeriodLocked, reversalTxDate, periodStatus)
		}
	}

	// 3. Fetch target entry lines
	linesQuery := `
		SELECT account_id, debit_amount_minor_units, credit_amount_minor_units, COALESCE(memo, '')
		FROM journal_entry_lines
		WHERE organization_id = $1 AND journal_entry_id = $2;
	`
	rows, err := tx.Query(ctx, linesQuery, orgID, entryID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch target entry lines: %w", err)
	}

	type targetLine struct {
		accountID   string
		debitMinor  int64
		creditMinor int64
		memo        string
	}
	var tLines []targetLine
	for rows.Next() {
		var l targetLine
		if err := rows.Scan(&l.accountID, &l.debitMinor, &l.creditMinor, &l.memo); err != nil {
			rows.Close()
			return nil, fmt.Errorf("failed to scan target entry line: %w", err)
		}
		tLines = append(tLines, l)
	}
	rows.Close()

	if len(tLines) == 0 {
		return nil, fmt.Errorf("target entry contains no lines to reverse")
	}

	// 4. Generate next entry number
	var nextEntryNum int64
	numQuery := `SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries WHERE organization_id = $1;`
	if err := tx.QueryRow(ctx, numQuery, orgID).Scan(&nextEntryNum); err != nil {
		return nil, fmt.Errorf("failed to generate journal entry number: %w", err)
	}

	// 5. Insert reversal entry
	reversalDesc := fmt.Sprintf("REVERSAL of Entry #%d: %s", targetNum, reason)
	var reversalEntry ledger.JournalEntry
	reversalEntry.OrganizationID = orgID
	reversalEntry.EntryNumber = nextEntryNum
	reversalEntry.TransactionDate = reversalTxDate
	reversalEntry.Description = reversalDesc
	reversalEntry.Status = "POSTED"
	reversalEntry.PostedByUserID = userID

	insertReversalQuery := `
		INSERT INTO journal_entries (organization_id, entry_number, transaction_date, description, status, posted_by_user_id)
		VALUES ($1, $2, $3::date, $4, 'POSTED', $5)
		RETURNING id, created_at;
	`
	if err := tx.QueryRow(ctx, insertReversalQuery, orgID, nextEntryNum, reversalTxDate, reversalDesc, userID).Scan(&reversalEntry.ID, &reversalEntry.CreatedAt); err != nil {
		return nil, fmt.Errorf("failed to insert reversal entry: %w", err)
	}

	// 6. Insert inverted lines
	insertLineQuery := `
		INSERT INTO journal_entry_lines (organization_id, journal_entry_id, account_id, debit_amount_minor_units, credit_amount_minor_units, memo)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id;
	`
	for _, tl := range tLines {
		var revLine ledger.JournalEntryLine
		revLine.OrganizationID = orgID
		revLine.JournalEntryID = reversalEntry.ID
		revLine.AccountID = tl.accountID
		// INVERT DEBIT AND CREDIT
		revLine.DebitAmountMinorUnits = tl.creditMinor
		revLine.CreditAmountMinorUnits = tl.debitMinor
		revLine.Memo = fmt.Sprintf("Reversal memo: %s", tl.memo)

		err := tx.QueryRow(ctx, insertLineQuery, orgID, reversalEntry.ID, tl.accountID, revLine.DebitAmountMinorUnits, revLine.CreditAmountMinorUnits, revLine.Memo).Scan(&revLine.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to insert reversal line: %w", err)
		}
		reversalEntry.Lines = append(reversalEntry.Lines, revLine)
	}

	// 7. Update target entry with reversed_by_entry_id
	updateTargetQuery := `
		UPDATE journal_entries
		SET reversed_by_entry_id = $1
		WHERE organization_id = $2 AND id = $3;
	`
	if _, err := tx.Exec(ctx, updateTargetQuery, reversalEntry.ID, orgID, entryID); err != nil {
		return nil, fmt.Errorf("failed to link reversal to target entry: %w", err)
	}

	// 8. Record audit log
	if correlationID == "" {
		correlationID = fmt.Sprintf("je-reverse-%d", targetNum)
	}
	changesJSON, _ := json.Marshal(map[string]interface{}{
		"target_entry_id":     entryID,
		"target_entry_number": targetNum,
		"reversal_entry_id":   reversalEntry.ID,
		"reversal_number":     nextEntryNum,
		"reason":              reason,
	})

	insertAuditQuery := `
		INSERT INTO audit_logs (organization_id, actor_id, actor_type, correlation_id, entity_type, entity_id, action, changes)
		VALUES ($1, $2, 'USER', $3, 'JOURNAL_ENTRY', $4, 'REVERSE', $5);
	`
	if _, err := tx.Exec(ctx, insertAuditQuery, orgID, userID, correlationID, entryID, changesJSON); err != nil {
		return nil, fmt.Errorf("failed to record reversal audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit reversal transaction: %w", err)
	}

	return &reversalEntry, nil
}
