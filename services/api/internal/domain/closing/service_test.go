package closing

import (
	"context"
	"testing"
)

func TestClosingServiceNilDB(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	t.Run("ListFiscalPeriods returns error on nil db", func(t *testing.T) {
		_, err := service.ListFiscalPeriods(ctx, "test-org")
		if err != ErrDatabaseUnavailable {
			t.Errorf("expected ErrDatabaseUnavailable, got %v", err)
		}
	})

	t.Run("GenerateFiscalPeriods returns error on nil db", func(t *testing.T) {
		_, err := service.GenerateFiscalPeriods(ctx, "test-org", 2026)
		if err != ErrDatabaseUnavailable {
			t.Errorf("expected ErrDatabaseUnavailable, got %v", err)
		}
	})
}

func TestGenerateFiscalPeriodsInvalidYear(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	_, err := service.GenerateFiscalPeriods(ctx, "test-org", 1850)
	if err != ErrYearRequired {
		t.Errorf("expected ErrYearRequired for year < 1900, got %v", err)
	}
}
