package reports

import (
	"context"
	"testing"
)

func TestReportsServiceNilDB(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	t.Run("GetTrialBalance returns error on nil db", func(t *testing.T) {
		_, err := service.GetTrialBalance(ctx, "test-org", "2026-01-01")
		if err != ErrDatabaseUnavailable {
			t.Errorf("expected ErrDatabaseUnavailable, got %v", err)
		}
	})

	t.Run("GetIncomeStatement returns error on nil db", func(t *testing.T) {
		_, err := service.GetIncomeStatement(ctx, "test-org", "2026-01-01", "2026-01-31")
		if err != ErrDatabaseUnavailable {
			t.Errorf("expected ErrDatabaseUnavailable, got %v", err)
		}
	})

	t.Run("GetBalanceSheet returns error on nil db", func(t *testing.T) {
		_, err := service.GetBalanceSheet(ctx, "test-org", "2026-01-01")
		if err != ErrDatabaseUnavailable {
			t.Errorf("expected ErrDatabaseUnavailable, got %v", err)
		}
	})
}

func TestIncomeStatementInvalidDateRange(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	_, err := service.GetIncomeStatement(ctx, "test-org", "2026-12-31", "2026-01-01")
	if err != ErrInvalidDateRange {
		t.Errorf("expected ErrInvalidDateRange when startDate > endDate, got %v", err)
	}
}
