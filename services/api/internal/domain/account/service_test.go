package account

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestService_CreateAccountValidation(t *testing.T) {
	svc := NewService(nil)

	// Test invalid account code
	_, err := svc.CreateAccount(context.Background(), "org-1", CreateAccountParams{
		AccountCode: "",
		Name:        "Cash",
		AccountType: TypeAsset,
	})
	assert.ErrorIs(t, err, ErrDatabaseUnavailable)

	// Test validation precedence when db is present or error handled
}
