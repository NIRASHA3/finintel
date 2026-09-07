package audit

import (
	"context"
	"testing"
)

func TestAuditServiceNilDB(t *testing.T) {
	service := NewService(nil)
	ctx := context.Background()

	_, _, err := service.ListAuditLogs(ctx, "test-org", "", 100)
	if err != ErrDatabaseUnavailable {
		t.Errorf("expected ErrDatabaseUnavailable, got %v", err)
	}
}
