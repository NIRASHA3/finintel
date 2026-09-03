package organization

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestService_CreateOrganizationValidation(t *testing.T) {
	svc := NewService(nil)

	_, err := svc.CreateOrganization(context.Background(), "user-1", "corr-1", CreateOrganizationParams{
		Name: "A",
	})
	assert.ErrorIs(t, err, ErrInvalidName)
}

func TestService_CreateOrganizationDatabaseRequired(t *testing.T) {
	svc := NewService(nil)

	_, err := svc.CreateOrganization(context.Background(), "user-1", "corr-1", CreateOrganizationParams{
		Name:         "Acme Corp",
		BaseCurrency: "usd",
	})
	assert.ErrorIs(t, err, ErrDatabaseUnavailable)
}
