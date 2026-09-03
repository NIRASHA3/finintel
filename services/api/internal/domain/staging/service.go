package staging

import (
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNoTransactionsToPost  = errors.New("no approved staged transactions found to post")
	ErrCashAccountNotFound   = errors.New("operating cash account (code 1010) not found in Chart of Accounts")
	ErrTargetAccountRequired = errors.New("target account must be assigned before approving a staged transaction")
	ErrTransactionNotFound   = errors.New("staged transaction not found")
	ErrDatabaseUnavailable   = errors.New("database connection is unavailable")
)

type StagedTransaction struct {
	ID                   string    `json:"id"`
	OrganizationID       string    `json:"organizationId"`
	TransactionDate      string    `json:"transactionDate"`
	Description          string    `json:"description"`
	AmountMinorUnits     int64     `json:"amountMinorUnits"`
	RawDataHash          string    `json:"rawDataHash"`
	Status               string    `json:"status"` // PENDING, APPROVED, REJECTED, POSTED
	SuggestedAccountID   string    `json:"suggestedAccountId,omitempty"`
	SuggestedAccountCode string    `json:"suggestedAccountCode,omitempty"`
	SuggestedAccountName string    `json:"suggestedAccountName,omitempty"`
	ConfidenceScore      float64   `json:"confidenceScore"`
	PostedJournalEntryID string    `json:"postedJournalEntryId,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
}

type BatchPostResult struct {
	PostedEntriesCount     int   `json:"postedEntriesCount"`
	TotalDebitsMinorUnits  int64 `json:"totalDebitsMinorUnits"`
	TotalCreditsMinorUnits int64 `json:"totalCreditsMinorUnits"`
}

type AccountRule struct {
	ID          string
	AccountCode string
	Name        string
	Keywords    []string
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) ParseAndStageCSV(ctx context.Context, orgID string, r io.Reader) (int, error) {
	if s.db == nil {
		return 0, ErrDatabaseUnavailable
	}

	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return 0, fmt.Errorf("failed to read CSV headers: %w", err)
	}

	dateIdx, descIdx, amtIdx := -1, -1, -1
	for i, h := range headers {
		cleanH := strings.ToLower(strings.TrimSpace(h))
		if strings.Contains(cleanH, "date") {
			dateIdx = i
		} else if strings.Contains(cleanH, "desc") || strings.Contains(cleanH, "memo") || strings.Contains(cleanH, "payee") {
			descIdx = i
		} else if strings.Contains(cleanH, "amount") || strings.Contains(cleanH, "total") {
			amtIdx = i
		}
	}

	if dateIdx == -1 {
		dateIdx = 0
	}
	if descIdx == -1 {
		descIdx = 1
	}
	if amtIdx == -1 {
		amtIdx = 2
	}

	rules := s.loadAccountRules(ctx, orgID)

	insertedCount := 0
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		if len(record) <= dateIdx || len(record) <= descIdx || len(record) <= amtIdx {
			continue
		}

		txDate := parseCSVDate(record[dateIdx])
		desc := strings.TrimSpace(record[descIdx])
		if desc == "" {
			continue
		}

		amtMinor := parseCSVAmount(record[amtIdx])
		if amtMinor == 0 {
			continue
		}

		hashStr := fmt.Sprintf("%s|%s|%d|%s", orgID, txDate, amtMinor, desc)
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(hashStr)))

		// SHA-256 Deduplication check via reference_number
		var exists bool
		dupQuery := `SELECT EXISTS(SELECT 1 FROM staged_transactions WHERE organization_id = $1 AND reference_number = $2);`
		if err := s.db.QueryRow(ctx, dupQuery, orgID, hash).Scan(&exists); err == nil && exists {
			continue // Skip duplicate
		}

		sID, conf := matchAccountRule(desc, rules)

		query := `
			INSERT INTO staged_transactions (organization_id, transaction_date, description, amount_minor_units, reference_number, status, suggested_category, confidence_score)
			VALUES ($1, $2::date, $3, $4, $5, 'PENDING_REVIEW', $6, $7);
		`
		var nullAccID interface{} = sID
		if sID == "" {
			nullAccID = nil
		}

		_, err = s.db.Exec(ctx, query, orgID, txDate, desc, amtMinor, hash, nullAccID, conf)
		if err == nil {
			insertedCount++
		}
	}

	return insertedCount, nil
}

func (s *Service) ListStagedTransactions(ctx context.Context, orgID string, statusFilter string) ([]StagedTransaction, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	statusFilter = strings.ToUpper(strings.TrimSpace(statusFilter))

	query := `
		SELECT st.id, st.organization_id, st.transaction_date::text, st.description, st.amount_minor_units, COALESCE(st.reference_number, ''),
		       st.status, COALESCE(st.suggested_category, ''), COALESCE(a.account_code, ''), COALESCE(a.name, ''),
		       COALESCE(st.confidence_score, 0.0), COALESCE(st.posted_journal_entry_id::text, ''), st.created_at
		FROM staged_transactions st
		LEFT JOIN accounts a ON st.suggested_category::uuid = a.id
		WHERE st.organization_id = $1
	`
	args := []interface{}{orgID}

	if statusFilter != "" && statusFilter != "ALL" {
		if statusFilter == "PENDING" {
			query += ` AND st.status = 'PENDING_REVIEW'`
		} else if statusFilter == "POSTED" {
			query += ` AND st.posted_journal_entry_id IS NOT NULL`
		} else {
			query += ` AND st.status = $2`
			args = append(args, statusFilter)
		}
	}

	query += ` ORDER BY st.transaction_date DESC, st.created_at DESC;`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query staged transactions: %w", err)
	}
	defer rows.Close()

	var items []StagedTransaction
	for rows.Next() {
		var item StagedTransaction
		var rawStatus string
		if err := rows.Scan(
			&item.ID, &item.OrganizationID, &item.TransactionDate, &item.Description, &item.AmountMinorUnits,
			&item.RawDataHash, &rawStatus, &item.SuggestedAccountID, &item.SuggestedAccountCode,
			&item.SuggestedAccountName, &item.ConfidenceScore, &item.PostedJournalEntryID, &item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan staged transaction: %w", err)
		}

		if item.PostedJournalEntryID != "" {
			item.Status = "POSTED"
		} else if rawStatus == "PENDING_REVIEW" {
			item.Status = "PENDING"
		} else {
			item.Status = rawStatus
		}

		items = append(items, item)
	}

	if items == nil {
		items = []StagedTransaction{}
	}

	return items, nil
}

func (s *Service) ApproveStagedTransaction(ctx context.Context, orgID string, id string, targetAccountID string) (*StagedTransaction, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	targetAccountID = strings.TrimSpace(targetAccountID)

	query := `
		UPDATE staged_transactions
		SET status = 'APPROVED',
		    suggested_category = COALESCE(NULLIF($3, ''), suggested_category)
		WHERE organization_id = $1 AND id = $2
		RETURNING id, organization_id, transaction_date::text, description, amount_minor_units, COALESCE(reference_number, ''), status, COALESCE(suggested_category, ''), COALESCE(confidence_score, 0.0), created_at;
	`
	var item StagedTransaction
	var rawStatus string
	err := s.db.QueryRow(ctx, query, orgID, id, targetAccountID).Scan(
		&item.ID, &item.OrganizationID, &item.TransactionDate, &item.Description, &item.AmountMinorUnits,
		&item.RawDataHash, &rawStatus, &item.SuggestedAccountID, &item.ConfidenceScore, &item.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, fmt.Errorf("failed to approve staged transaction: %w", err)
	}

	if item.SuggestedAccountID == "" {
		return nil, ErrTargetAccountRequired
	}

	item.Status = "APPROVED"
	return &item, nil
}

func (s *Service) RejectStagedTransaction(ctx context.Context, orgID string, id string) (*StagedTransaction, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	query := `
		UPDATE staged_transactions
		SET status = 'REJECTED'
		WHERE organization_id = $1 AND id = $2
		RETURNING id, organization_id, transaction_date::text, description, amount_minor_units, COALESCE(reference_number, ''), status, COALESCE(suggested_category, ''), COALESCE(confidence_score, 0.0), created_at;
	`
	var item StagedTransaction
	var rawStatus string
	err := s.db.QueryRow(ctx, query, orgID, id).Scan(
		&item.ID, &item.OrganizationID, &item.TransactionDate, &item.Description, &item.AmountMinorUnits,
		&item.RawDataHash, &rawStatus, &item.SuggestedAccountID, &item.ConfidenceScore, &item.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, fmt.Errorf("failed to reject staged transaction: %w", err)
	}

	item.Status = "REJECTED"
	return &item, nil
}

func (s *Service) BatchPostApprovedTransactions(ctx context.Context, orgID string, userID string) (*BatchPostResult, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start batch posting transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// 1. Find Operating Cash Account (Code 1010)
	var cashAccountID string
	cashQuery := `SELECT id FROM accounts WHERE organization_id = $1 AND account_code = '1010' AND is_active = true LIMIT 1;`
	if err := tx.QueryRow(ctx, cashQuery, orgID).Scan(&cashAccountID); err != nil {
		return nil, ErrCashAccountNotFound
	}

	// 2. Query all APPROVED staged transactions not yet posted
	stagedQuery := `
		SELECT id, transaction_date::text, description, amount_minor_units, suggested_category
		FROM staged_transactions
		WHERE organization_id = $1 AND status = 'APPROVED' AND suggested_category IS NOT NULL AND posted_journal_entry_id IS NULL;
	`
	rows, err := tx.Query(ctx, stagedQuery, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to query approved staged transactions: %w", err)
	}

	type approvedTx struct {
		id                 string
		transactionDate    string
		description        string
		amountMinorUnits   int64
		suggestedAccountID string
	}
	var approvedItems []approvedTx
	for rows.Next() {
		var item approvedTx
		if err := rows.Scan(&item.id, &item.transactionDate, &item.description, &item.amountMinorUnits, &item.suggestedAccountID); err == nil {
			approvedItems = append(approvedItems, item)
		}
	}
	rows.Close()

	if len(approvedItems) == 0 {
		return nil, ErrNoTransactionsToPost
	}

	result := &BatchPostResult{}

	for _, item := range approvedItems {
		var nextEntryNum int64
		numQuery := `SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries WHERE organization_id = $1;`
		if err := tx.QueryRow(ctx, numQuery, orgID).Scan(&nextEntryNum); err != nil {
			return nil, fmt.Errorf("failed to generate entry number: %w", err)
		}

		// Create Journal Entry
		insertEntryQuery := `
			INSERT INTO journal_entries (organization_id, entry_number, transaction_date, description, status, posted_by_user_id)
			VALUES ($1, $2, $3::date, $4, 'POSTED', $5)
			RETURNING id;
		`
		var entryID string
		if err := tx.QueryRow(ctx, insertEntryQuery, orgID, nextEntryNum, item.transactionDate, item.description, userID).Scan(&entryID); err != nil {
			return nil, fmt.Errorf("failed to insert journal entry for staged item %s: %w", item.id, err)
		}

		absAmount := int64(math.Abs(float64(item.amountMinorUnits)))
		insertLineQuery := `
			INSERT INTO journal_entry_lines (organization_id, journal_entry_id, account_id, debit_amount_minor_units, credit_amount_minor_units, memo)
			VALUES ($1, $2, $3, $4, $5, $6);
		`

		if item.amountMinorUnits > 0 {
			// Income: Debit Cash (1010), Credit Target Account
			_, _ = tx.Exec(ctx, insertLineQuery, orgID, entryID, cashAccountID, absAmount, 0, "Cash Inflow")
			_, _ = tx.Exec(ctx, insertLineQuery, orgID, entryID, item.suggestedAccountID, 0, absAmount, item.description)
		} else {
			// Expense: Debit Target Account, Credit Cash (1010)
			_, _ = tx.Exec(ctx, insertLineQuery, orgID, entryID, item.suggestedAccountID, absAmount, 0, item.description)
			_, _ = tx.Exec(ctx, insertLineQuery, orgID, entryID, cashAccountID, 0, absAmount, "Cash Outflow")
		}

		// Update staged transaction with posted_journal_entry_id
		updateStagedQuery := `UPDATE staged_transactions SET posted_journal_entry_id = $3 WHERE organization_id = $1 AND id = $2;`
		if _, err := tx.Exec(ctx, updateStagedQuery, orgID, item.id, entryID); err != nil {
			return nil, fmt.Errorf("failed to update staged transaction posted_journal_entry_id: %w", err)
		}

		result.PostedEntriesCount++
		result.TotalDebitsMinorUnits += absAmount
		result.TotalCreditsMinorUnits += absAmount
	}

	// Record atomic audit log entry
	auditChanges, _ := json.Marshal(map[string]interface{}{
		"posted_count": result.PostedEntriesCount,
		"total_debits": result.TotalDebitsMinorUnits,
	})
	insertAuditQuery := `
		INSERT INTO audit_logs (organization_id, actor_id, actor_type, correlation_id, entity_type, entity_id, action, changes)
		VALUES ($1, $2, 'USER', $3, 'STAGED_TRANSACTION', $1, 'POST', $4);
	`
	correlationID := fmt.Sprintf("batch-post-%d", time.Now().Unix())
	if _, err := tx.Exec(ctx, insertAuditQuery, orgID, userID, correlationID, auditChanges); err != nil {
		return nil, fmt.Errorf("failed to record batch post audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit batch post transaction: %w", err)
	}

	return result, nil
}

func (s *Service) loadAccountRules(ctx context.Context, orgID string) []AccountRule {
	query := `SELECT id, account_code, name FROM accounts WHERE organization_id = $1 AND is_active = true;`
	rows, err := s.db.Query(ctx, query, orgID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var rules []AccountRule
	for rows.Next() {
		var r AccountRule
		if err := rows.Scan(&r.ID, &r.AccountCode, &r.Name); err == nil {
			tokens := strings.Fields(strings.ToLower(r.Name))
			r.Keywords = tokens
			rules = append(rules, r)
		}
	}
	return rules
}

func matchAccountRule(desc string, rules []AccountRule) (string, float64) {
	cleanDesc := strings.ToLower(desc)

	kwMap := map[string]string{
		"aws":        "5020",
		"amazon web": "5020",
		"github":     "5020",
		"stripe":     "4010",
		"wework":     "5040",
		"rent":       "5040",
		"salary":     "5010",
		"payroll":    "5010",
		"google":     "5030",
		"facebook":   "5030",
		"ad":         "5030",
	}

	for kw, code := range kwMap {
		if strings.Contains(cleanDesc, kw) {
			for _, r := range rules {
				if r.AccountCode == code {
					return r.ID, 0.90
				}
			}
		}
	}

	for _, r := range rules {
		for _, kw := range r.Keywords {
			if len(kw) > 3 && strings.Contains(cleanDesc, kw) {
				return r.ID, 0.70
			}
		}
	}

	return "", 0.0
}

func parseCSVDate(raw string) string {
	raw = strings.TrimSpace(raw)
	formats := []string{"2006-01-02", "01/02/2006", "1/2/2006", "02/01/2006", "2006/01/02"}
	for _, f := range formats {
		if t, err := time.Parse(f, raw); err == nil {
			return t.Format("2006-01-02")
		}
	}
	return time.Now().UTC().Format("2006-01-02")
}

func parseCSVAmount(raw string) int64 {
	raw = strings.TrimSpace(raw)
	raw = strings.ReplaceAll(raw, "$", "")
	raw = strings.ReplaceAll(raw, ",", "")

	val, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0
	}
	return int64(math.Round(val * 100))
}
