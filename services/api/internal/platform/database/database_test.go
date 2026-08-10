package database_test

import (
	"context"
	"testing"

	"github.com/NIRASHA3/finintel/services/api/internal/platform/database"
	"github.com/stretchr/testify/assert"
)

func TestUninitializedPoolPing(t *testing.T) {
	var db *database.PostgresDB
	err := db.Ping(context.Background())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "uninitialized")
}
