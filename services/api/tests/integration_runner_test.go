package tests

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
)

func TestPostgreSQL_FullIntegrationSuite(t *testing.T) {
	adminURL := os.Getenv("TEST_ADMIN_DATABASE_URL")
	if adminURL == "" {
		adminURL = "postgres://finintel_user:finintel_pass@127.0.0.1:5433/finintel_dev?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	adminConn, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		adminURL = "postgres://postgres:postgres@localhost:5433/postgres?sslmode=disable"
		adminConn, err = pgx.Connect(ctx, adminURL)
		if err != nil {
			t.Fatalf("CI/Test Failure: Cannot connect to PostgreSQL admin database: %v", err)
		}
	}
	defer adminConn.Close(ctx)

	// Step 1: Execute setup_roles.sql
	setupRolesSQL, err := os.ReadFile("../../../database/scripts/setup_roles.sql")
	require.NoError(t, err)

	_, err = adminConn.Exec(ctx, string(setupRolesSQL))
	require.NoError(t, err, "Failed to execute setup_roles.sql")

	// Step 2: Create ephemeral test database and login roles
	_, _ = adminConn.Exec(ctx, "DROP DATABASE IF EXISTS finintel_test_db;")
	_, err = adminConn.Exec(ctx, "CREATE DATABASE finintel_test_db;")
	require.NoError(t, err)

	_, err = adminConn.Exec(ctx, "ALTER DATABASE finintel_test_db OWNER TO finintel_owner;")
	require.NoError(t, err)

	_, _ = adminConn.Exec(ctx, "DROP USER IF EXISTS test_owner_login;")
	_, _ = adminConn.Exec(ctx, "DROP USER IF EXISTS test_app_login;")
	_, _ = adminConn.Exec(ctx, "DROP USER IF EXISTS test_bff_login;")

	_, err = adminConn.Exec(ctx, "CREATE USER test_owner_login WITH PASSWORD 'owner_pass' IN ROLE finintel_owner NOINHERIT;")
	require.NoError(t, err)
	_, err = adminConn.Exec(ctx, "CREATE USER test_app_login WITH PASSWORD 'app_pass' IN ROLE finintel_app NOINHERIT;")
	require.NoError(t, err)
	_, err = adminConn.Exec(ctx, "CREATE USER test_bff_login WITH PASSWORD 'bff_pass' IN ROLE finintel_bff NOINHERIT;")
	require.NoError(t, err)
	_, err = adminConn.Exec(ctx, "GRANT finintel_owner TO test_owner_login; GRANT finintel_app TO test_app_login; GRANT finintel_bff TO test_bff_login;")
	require.NoError(t, err)

	parsedAdminURL, parseErr := url.Parse(adminURL)
	require.NoError(t, parseErr)
	dbHostPort := parsedAdminURL.Host

	testDBURLParsed := *parsedAdminURL
	testDBURLParsed.Path = "/finintel_test_db"
	adminTestDBURL := testDBURLParsed.String()
	adminTestConn, err := pgx.Connect(ctx, adminTestDBURL)
	require.NoError(t, err, "Failed to connect to test db as admin")
	_, err = adminTestConn.Exec(ctx, "ALTER SCHEMA public OWNER TO finintel_owner; GRANT ALL ON SCHEMA public TO finintel_owner;")
	require.NoError(t, err, "Failed to transfer public schema owner to finintel_owner")
	adminTestConn.Close(ctx)

	ownerDBURL := fmt.Sprintf("postgres://test_owner_login:owner_pass@%s/finintel_test_db?sslmode=disable&options=-c%%20role%%3Dfinintel_owner", dbHostPort)

	// Pre-migration assertion: test_owner_login must startup with role finintel_owner
	assertConn, err := pgx.Connect(ctx, ownerDBURL)
	require.NoError(t, err)
	var preMigCurrUser, preMigSessUser string
	err = assertConn.QueryRow(ctx, "SELECT current_user, session_user").Scan(&preMigCurrUser, &preMigSessUser)
	require.NoError(t, err)
	require.Equal(t, "finintel_owner", preMigCurrUser, "Pre-migration assertion: current_user must be finintel_owner")
	require.Equal(t, "test_owner_login", preMigSessUser, "Pre-migration assertion: session_user must be test_owner_login")
	assertConn.Close(ctx)

	// Step 3: Run Goose migrations under finintel_owner
	if goosePath, lookErr := exec.LookPath("goose"); lookErr == nil {
		cmd := exec.Command(goosePath, "-dir", "../../../database/migrations", "postgres", ownerDBURL, "up")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err := cmd.Run()
		require.NoError(t, err, "Goose CLI migration execution failed")
	} else {
		// Fallback: Connect as test_owner_login, SET ROLE finintel_owner, and execute migration files
		ownerConn, err := pgx.Connect(ctx, ownerDBURL)
		require.NoError(t, err)
		defer ownerConn.Close(ctx)

		_, err = ownerConn.Exec(ctx, "SET ROLE finintel_owner;")
		require.NoError(t, err)

		migrationFiles := []string{
			"../../../database/migrations/00001_initial_schema.sql",
			"../../../database/migrations/00002_update_audit_logs_action.sql",
			"../../../database/migrations/00003_security_hardening.sql",
		}

		for _, migFile := range migrationFiles {
			sqlBytes, err := os.ReadFile(migFile)
			require.NoError(t, err, "Failed to read migration file %s", migFile)
			content := string(sqlBytes)
			if parts := strings.Split(content, "-- +goose Down"); len(parts) > 0 {
				content = parts[0]
			}
			content = strings.ReplaceAll(content, "-- +goose Up", "")
			_, err = ownerConn.Exec(ctx, content)
			require.NoError(t, err, "Failed to run migration file %s", migFile)
		}
	}

	appDBURL := fmt.Sprintf("postgres://test_app_login:app_pass@%s/finintel_test_db?sslmode=disable", dbHostPort)
	os.Setenv("DATABASE_URL", appDBURL)

	fmt.Println("POSTGRESQL INTEGRATION SUITE MIGRATED AND INITIALIZED SUCCESSFULLY")
}
