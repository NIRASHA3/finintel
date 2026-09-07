package fx

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFX_RatesAndRevaluation(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	rates, err := service.ListRates(ctx, "org-test")
	assert.NoError(t, err)
	assert.NotEmpty(t, rates)

	upserted, err := service.UpsertRate(ctx, "org-test", "USD", "EUR", 0.95, "2026-09-07")
	assert.NoError(t, err)
	assert.Equal(t, 0.95, upserted.Rate)

	reval, err := service.RunRevaluation(ctx, "org-test", "USD", "EUR", 10000.0, "2026-09-07")
	assert.NoError(t, err)
	assert.NotNil(t, reval)
	assert.Equal(t, "POSTED", reval.Status)
	assert.Equal(t, 9500.0, reval.RevaluedBaseAmount)
}
