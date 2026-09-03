package ledger

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestService_UnbalancedEntryRejection(t *testing.T) {
	svc := NewService(nil)

	// Debits = 10000 (100.00), Credits = 5000 (50.00) -> Unbalanced
	params := CreateJournalEntryParams{
		Description:     "Unbalanced Posting Attempt",
		TransactionDate: "2026-09-03",
		Lines: []JournalEntryLineRequest{
			{AccountID: "acc-1", DebitAmountMinorUnits: 10000, CreditAmountMinorUnits: 0},
			{AccountID: "acc-2", DebitAmountMinorUnits: 0, CreditAmountMinorUnits: 5000},
		},
	}

	_, err := svc.PostJournalEntry(context.Background(), "org-1", "user-1", "corr-1", params)
	assert.ErrorIs(t, err, ErrUnbalancedJournalEntry)
}

func TestService_InvalidLineAmountRejection(t *testing.T) {
	svc := NewService(nil)

	// Debit AND Credit on same line -> Invalid XOR
	params := CreateJournalEntryParams{
		Description:     "Invalid Line Posting",
		TransactionDate: "2026-09-03",
		Lines: []JournalEntryLineRequest{
			{AccountID: "acc-1", DebitAmountMinorUnits: 10000, CreditAmountMinorUnits: 5000},
			{AccountID: "acc-2", DebitAmountMinorUnits: 0, CreditAmountMinorUnits: 5000},
		},
	}

	_, err := svc.PostJournalEntry(context.Background(), "org-1", "user-1", "corr-1", params)
	assert.ErrorIs(t, err, ErrInvalidLineAmount)
}

func TestService_MinLinesRejection(t *testing.T) {
	svc := NewService(nil)

	params := CreateJournalEntryParams{
		Description:     "Single Line Posting",
		TransactionDate: "2026-09-03",
		Lines: []JournalEntryLineRequest{
			{AccountID: "acc-1", DebitAmountMinorUnits: 10000, CreditAmountMinorUnits: 0},
		},
	}

	_, err := svc.PostJournalEntry(context.Background(), "org-1", "user-1", "corr-1", params)
	assert.ErrorIs(t, err, ErrInvalidEntryLines)
}
