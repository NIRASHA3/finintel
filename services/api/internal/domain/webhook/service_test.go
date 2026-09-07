package webhook

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWebhook_SubscriptionFlow(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	sub, err := service.CreateSubscription(ctx, "org-test", "https://example.com/webhook", []string{"period.closed"})
	assert.NoError(t, err)
	assert.NotNil(t, sub)
	assert.Equal(t, "https://example.com/webhook", sub.TargetURL)
	assert.NotEmpty(t, sub.SecretToken)

	subs, err := service.ListSubscriptions(ctx, "org-test")
	assert.NoError(t, err)
	assert.Len(t, subs, 1)

	logs, err := service.DispatchEvent(ctx, "org-test", "period.closed", map[string]interface{}{"period_id": "p-1"})
	assert.NoError(t, err)
	assert.Len(t, logs, 1)
	assert.True(t, logs[0].Success)

	err = service.DeleteSubscription(ctx, "org-test", sub.ID)
	assert.NoError(t, err)

	subsAfter, _ := service.ListSubscriptions(ctx, "org-test")
	assert.Empty(t, subsAfter)
}
