package reconciliation

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReconciliation_AutoMatch_Empty(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	matches, err := service.AutoMatch(ctx, "org-test", []BankTransaction{})
	assert.NoError(t, err)
	assert.Empty(t, matches)
}

func TestReconciliation_AutoMatch_Basic(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	txs := []BankTransaction{
		{
			ID:              "bt-101",
			TransactionDate: "2026-09-01",
			AmountMinor:     150000,
			Reference:       "INV-9901",
			Description:     "Vendor Payout",
		},
	}

	matches, err := service.AutoMatch(ctx, "org-test", txs)
	assert.NoError(t, err)
	assert.Len(t, matches, 1)
	assert.Equal(t, "UNMATCHED", matches[0].MatchStatus)
}
