package http

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
)

func TestWriteSanitizedDbError_UnknownErrorIsServerFailure(t *testing.T) {
	recorder := httptest.NewRecorder()

	writeSanitizedDbError(recorder, errors.New("connection reset"), "QUERY_FAILED", "Query failed")

	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.JSONEq(t, `{"error":"QUERY_FAILED","message":"Query failed"}`, recorder.Body.String())
}

func TestWriteSanitizedDbError_MappedClientError(t *testing.T) {
	recorder := httptest.NewRecorder()

	writeSanitizedDbError(recorder, &pgconn.PgError{Code: "22023"}, "QUERY_FAILED", "Query failed")

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.JSONEq(t, `{"error":"INVALID_INPUT","message":"Invalid input parameters provided"}`, recorder.Body.String())
}
