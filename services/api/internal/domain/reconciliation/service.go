package reconciliation

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidParams       = errors.New("invalid reconciliation parameters")
	ErrMatchNotFound       = errors.New("reconciliation match item not found")
	ErrAlreadyMatched      = errors.New("bank transaction is already reconciled")
	ErrDatabaseUnavailable = errors.New("database connection is unavailable")
)

type BankTransaction struct {
	ID              string `json:"id"`
	TransactionDate string `json:"transaction_date"` // YYYY-MM-DD
	AmountMinor     int64  `json:"amount_minor_units"`
	Reference       string `json:"reference"`
	Description     string `json:"description"`
	Reconciled      bool   `json:"reconciled"`
	MatchedEntryID  string `json:"matched_entry_id,omitempty"`
}

type MatchedJournalEntry struct {
	EntryID         string `json:"entry_id"`
	EntryNumber     int64  `json:"entry_number"`
	TransactionDate string `json:"transaction_date"`
	Description     string `json:"description"`
	AmountMinor     int64  `json:"amount_minor_units"`
}

type MatchResult struct {
	ID                string               `json:"id"`
	BankTransactionID string               `json:"bank_transaction_id"`
	BankDate          string               `json:"bank_date"`
	BankAmountMinor   int64                `json:"bank_amount_minor_units"`
	BankReference     string               `json:"bank_reference"`
	MatchedEntry      *MatchedJournalEntry `json:"matched_entry,omitempty"`
	ConfidenceScore   float64              `json:"confidence_score"`
	MatchStatus       string               `json:"match_status"` // "EXACT_MATCH", "HIGH_CONFIDENCE", "SUGGESTED", "UNMATCHED", "MANUALLY_MATCHED"
	DiscrepancyReason string               `json:"discrepancy_reason,omitempty"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) AutoMatch(ctx context.Context, orgID string, bankTransactions []BankTransaction) ([]MatchResult, error) {
	if len(bankTransactions) == 0 {
		return []MatchResult{}, nil
	}

	var journalEntries []MatchedJournalEntry

	if s.db != nil {
		query := `
			SELECT e.id, e.entry_number, e.transaction_date::text, e.description,
			       COALESCE(SUM(l.debit_amount_minor_units), 0) as total_amount
			FROM journal_entries e
			JOIN journal_entry_lines l ON l.journal_entry_id = e.id
			WHERE e.organization_id = $1 AND e.status = 'POSTED'
			GROUP BY e.id, e.entry_number, e.transaction_date, e.description;
		`
		rows, err := s.db.Query(ctx, query, orgID)
		if err == nil {
			for rows.Next() {
				var je MatchedJournalEntry
				if err := rows.Scan(&je.EntryID, &je.EntryNumber, &je.TransactionDate, &je.Description, &je.AmountMinor); err == nil {
					journalEntries = append(journalEntries, je)
				}
			}
			rows.Close()
		}
	}

	var results []MatchResult
	usedEntries := make(map[string]bool)

	for idx, bt := range bankTransactions {
		matchID := fmt.Sprintf("rec-%s-%d", orgID, idx+1)
		res := MatchResult{
			ID:                matchID,
			BankTransactionID: bt.ID,
			BankDate:          bt.TransactionDate,
			BankAmountMinor:   bt.AmountMinor,
			BankReference:     bt.Reference,
			MatchStatus:       "UNMATCHED",
			ConfidenceScore:   0.0,
		}

		bankDate, _ := time.Parse("2006-01-02", bt.TransactionDate)
		var bestMatch *MatchedJournalEntry
		var bestScore float64 = 0.0
		var bestStatus string = "UNMATCHED"

		for i := range journalEntries {
			je := journalEntries[i]
			if usedEntries[je.EntryID] {
				continue
			}

			// Check amount equality (exact or absolute value match)
			amountMatch := (bt.AmountMinor == je.AmountMinor) || (bt.AmountMinor == -je.AmountMinor)
			if !amountMatch {
				continue
			}

			jeDate, _ := time.Parse("2006-01-02", je.TransactionDate)
			daysDiff := math.Abs(bankDate.Sub(jeDate).Hours() / 24.0)

			refMatch := false
			if bt.Reference != "" && strings.Contains(strings.ToLower(je.Description), strings.ToLower(bt.Reference)) {
				refMatch = true
			}

			score := 0.0
			status := "UNMATCHED"

			if daysDiff == 0 && refMatch {
				score = 1.00
				status = "EXACT_MATCH"
			} else if daysDiff == 0 {
				score = 0.90
				status = "HIGH_CONFIDENCE"
			} else if daysDiff <= 3 {
				score = 0.80
				status = "HIGH_CONFIDENCE"
			} else if daysDiff <= 7 {
				score = 0.65
				status = "SUGGESTED"
			}

			if score > bestScore {
				bestScore = score
				bestStatus = status
				entryCopy := je
				bestMatch = &entryCopy
			}
		}

		if bestMatch != nil && bestScore >= 0.60 {
			res.MatchedEntry = bestMatch
			res.ConfidenceScore = bestScore
			res.MatchStatus = bestStatus
			usedEntries[bestMatch.EntryID] = true
		} else {
			res.DiscrepancyReason = "No matching posted journal entry found within 7-day date window"
		}

		results = append(results, res)
	}

	return results, nil
}
