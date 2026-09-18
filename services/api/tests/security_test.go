package tests

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getTestPool(t *testing.T) *pgxpool.Pool {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://test_app_login:app_pass@localhost:5433/finintel_test_db?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("CI/Test Failure: Failed to connect to database at %s: %v", dbURL, err)
	}

	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("CI/Test Failure: Database ping failed at %s: %v", dbURL, err)
	}

	return pool
}

func getBFFConn(t *testing.T) *pgx.Conn {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://test_app_login:app_pass@localhost:5433/finintel_test_db?sslmode=disable"
	}
	bffURL := strings.Replace(dbURL, "test_app_login:app_pass", "test_bff_login:bff_pass", 1)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, bffURL)
	if err != nil {
		t.Fatalf("CI/Test Failure: Cannot connect as BFF role at %s: %v", bffURL, err)
	}

	_, err = conn.Exec(ctx, "SET ROLE finintel_bff;")
	if err != nil {
		t.Fatalf("CI/Test Failure: SET ROLE finintel_bff failed: %v", err)
	}

	return conn
}

func provisionTestUserAndOrg(ctx context.Context, conn *pgxpool.Conn, issuer, subject, orgName string) (string, string, error) {
	var userID, orgID string
	email := fmt.Sprintf("%s@example.com", subject)
	fullName := fmt.Sprintf("User %s", subject)
	err := conn.QueryRow(ctx, "SELECT id FROM public.fn_provision_user($1, $2, $3, $4);", issuer, subject, email, fullName).Scan(&userID)
	if err != nil {
		return "", "", fmt.Errorf("fn_provision_user failed: %w", err)
	}

	_, err = conn.Exec(ctx, "SELECT set_config('app.current_user_id', $1, false);", userID)
	if err != nil {
		return "", "", fmt.Errorf("set_config user_id failed: %w", err)
	}

	err = conn.QueryRow(ctx, "SELECT id FROM public.fn_create_organization_with_owner($1, 'USD', 1, 'corr-test');", orgName).Scan(&orgID)
	if err != nil {
		return "", "", fmt.Errorf("fn_create_organization_with_owner failed: %w", err)
	}

	return userID, orgID, nil
}

func TestSecurity_RuntimeRolePermissions(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, err = conn.Exec(ctx, "SET ROLE finintel_app;")
	require.NoError(t, err)

	var currentUser, sessionUser string
	var rolsuper, rolbypassrls bool
	err = conn.QueryRow(ctx, `
		SELECT current_user, session_user,
		       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),
		       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user);
	`).Scan(&currentUser, &sessionUser, &rolsuper, &rolbypassrls)
	require.NoError(t, err)

	assert.Equal(t, "finintel_app", currentUser)
	assert.NotEqual(t, "postgres", currentUser)
	assert.False(t, rolsuper, "finintel_app must NOT be superuser")
	assert.False(t, rolbypassrls, "finintel_app must NOT have BYPASSRLS")

	// Verify runtime role is NOT table owner
	var accountsOwner string
	err = conn.QueryRow(ctx, `
		SELECT pg_get_userbyid(relowner)
		FROM pg_class
		WHERE relname = 'accounts' AND relnamespace = 'public'::regnamespace;
	`).Scan(&accountsOwner)
	require.NoError(t, err)
	assert.Equal(t, "finintel_owner", accountsOwner)
	assert.NotEqual(t, currentUser, accountsOwner, "finintel_app must NOT be the table owner")
}

func TestSecurity_FORCERLSOnAllTables(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()

	protectedTables := []string{
		"organizations",
		"users",
		"organization_memberships",
		"accounts",
		"journal_entries",
		"journal_entry_lines",
		"staged_transactions",
		"fiscal_periods",
		"audit_logs",
	}

	for _, tbl := range protectedTables {
		t.Run("Table_"+tbl, func(t *testing.T) {
			var rlsEnabled, rlsForced bool
			var tableOwner string
			err := pool.QueryRow(ctx, `
				SELECT relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner)
				FROM pg_class
				WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
			`, tbl).Scan(&rlsEnabled, &rlsForced, &tableOwner)

			require.NoError(t, err, "Failed to query RLS status for table %s", tbl)
			assert.True(t, rlsEnabled, "RLS must be ENABLED on %s", tbl)
			assert.True(t, rlsForced, "RLS must be FORCED on %s", tbl)
			assert.Equal(t, "finintel_owner", tableOwner, "Table %s must be owned by finintel_owner", tbl)
		})
	}
}

func TestSecurity_DirectDMLRevoked(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, _ = conn.Exec(ctx, "SET ROLE finintel_app;")

	assertSQLState42501 := func(t *testing.T, err error, action string) {
		require.Error(t, err, "Expected permission error for %s", action)
		var pgErr *pgconn.PgError
		require.True(t, errors.As(err, &pgErr), "Error must be *pgconn.PgError")
		assert.Equal(t, "42501", pgErr.Code, "SQLSTATE must be exact 42501 for %s", action)
	}

	t.Run("Direct INSERT on users revoked", func(t *testing.T) {
		_, err := conn.Exec(ctx, `
			INSERT INTO public.users (id, identity_provider_issuer, external_subject_id)
			VALUES ($1, 'test', 'test');
		`, uuid.NewString())
		assertSQLState42501(t, err, "INSERT users")
	})

	t.Run("Direct INSERT on organization_memberships revoked", func(t *testing.T) {
		_, err := conn.Exec(ctx, `
			INSERT INTO public.organization_memberships (id, organization_id, user_id, role)
			VALUES ($1, $2, $3, 'OWNER');
		`, uuid.NewString(), uuid.NewString(), uuid.NewString())
		assertSQLState42501(t, err, "INSERT organization_memberships")
	})

	t.Run("Direct INSERT on organizations revoked", func(t *testing.T) {
		_, err := conn.Exec(ctx, `
			INSERT INTO public.organizations (id, name, base_currency)
			VALUES ($1, 'Test', 'USD');
		`, uuid.NewString())
		assertSQLState42501(t, err, "INSERT organizations")
	})
}

func TestSecurity_AuditAppendOnly(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, _ = conn.Exec(ctx, "SET ROLE finintel_app;")

	assertSQLState42501 := func(t *testing.T, err error, action string) {
		require.Error(t, err, "Expected permission error for %s", action)
		var pgErr *pgconn.PgError
		require.True(t, errors.As(err, &pgErr), "Error must be *pgconn.PgError")
		assert.Equal(t, "42501", pgErr.Code, "SQLSTATE must be exact 42501 for %s", action)
	}

	t.Run("Direct UPDATE on audit_logs revoked", func(t *testing.T) {
		_, err := conn.Exec(ctx, "UPDATE public.audit_logs SET action = 'HACKED';")
		assertSQLState42501(t, err, "UPDATE audit_logs")
	})

	t.Run("Direct DELETE on audit_logs revoked", func(t *testing.T) {
		_, err := conn.Exec(ctx, "DELETE FROM public.audit_logs;")
		assertSQLState42501(t, err, "DELETE audit_logs")
	})
}

func TestSecurity_SecurityDefinerSearchPath(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()

	functions := []string{
		"fn_provision_user",
		"fn_create_organization_with_owner",
		"fn_list_organization_members",
		"fn_add_member",
		"fn_update_member_role",
		"fn_remove_member",
	}

	for _, fnName := range functions {
		t.Run("Function_"+fnName, func(t *testing.T) {
			var searchPath string
			var isSecurityDefiner bool
			err := pool.QueryRow(ctx, `
				SELECT prosecdef, pg_get_functiondef(p.oid)
				FROM pg_proc p
				JOIN pg_namespace n ON p.pronamespace = n.oid
				WHERE n.nspname = 'public' AND p.proname = $1;
			`, fnName).Scan(&isSecurityDefiner, &searchPath)

			require.NoError(t, err, "Function %s must exist in public schema", fnName)
			assert.True(t, isSecurityDefiner, "Function %s must be SECURITY DEFINER", fnName)
			assert.Contains(t, searchPath, "SET search_path TO 'pg_catalog'", "Function %s must fix search_path to pg_catalog", fnName)
		})
	}
}

func TestSecurity_ConnectionContextLeakage(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()

	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	// Transaction 1: Set transaction-local GUC
	tx1, err := conn.Begin(ctx)
	require.NoError(t, err)

	fakeUserID := uuid.NewString()
	_, err = tx1.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true)", fakeUserID)
	require.NoError(t, err)

	var currentGUC string
	err = tx1.QueryRow(ctx, "SELECT current_setting('app.current_user_id', true)").Scan(&currentGUC)
	require.NoError(t, err)
	assert.Equal(t, fakeUserID, currentGUC)

	err = tx1.Commit(ctx)
	require.NoError(t, err)

	// Transaction 2: Verify GUC is completely empty on the same connection
	tx2, err := conn.Begin(ctx)
	require.NoError(t, err)

	var leakedGUC string
	err = tx2.QueryRow(ctx, "SELECT current_setting('app.current_user_id', true)").Scan(&leakedGUC)
	require.NoError(t, err)
	assert.Empty(t, leakedGUC, "app.current_user_id must NOT leak across transactions on reused connection")

	_ = tx2.Rollback(ctx)
}

func TestSecurity_PublicFunctionPrivileges(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()

	functions := []string{
		"fn_provision_user",
		"fn_create_organization_with_owner",
		"fn_list_organization_members",
		"fn_add_member",
		"fn_update_member_role",
		"fn_remove_member",
	}

	for _, fnName := range functions {
		t.Run("PublicExecutionRevoked_"+fnName, func(t *testing.T) {
			var hasExecutePrivilege bool
			err := pool.QueryRow(ctx, `
				SELECT has_function_privilege('public', p.oid, 'EXECUTE')
				FROM pg_proc p
				JOIN pg_namespace n ON p.pronamespace = n.oid
				WHERE n.nspname = 'public' AND p.proname = $1;
			`, fnName).Scan(&hasExecutePrivilege)

			require.NoError(t, err, "Function %s must exist in public schema", fnName)
			assert.False(t, hasExecutePrivilege, "PUBLIC must NOT have EXECUTE privilege on %s", fnName)
		})
	}
}

func TestSecurity_CrossTenant_SELECT_Isolation(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, err = conn.Exec(ctx, "SET ROLE finintel_app;")
	require.NoError(t, err)

	// Setup: Provision Org A and Org B
	userA, orgA, err := provisionTestUserAndOrg(ctx, conn, "test-issuer", "sub-cross-select-a-"+uuid.NewString()[:8], "Org A Select")
	require.NoError(t, err)
	userB, orgB, err := provisionTestUserAndOrg(ctx, conn, "test-issuer", "sub-cross-select-b-"+uuid.NewString()[:8], "Org B Select")
	require.NoError(t, err)

	// Seed account in Org A under Org A context
	txA, err := conn.Begin(ctx)
	require.NoError(t, err)
	_, err = txA.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true);", userA)
	require.NoError(t, err)
	_, err = txA.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, true);", orgA)
	require.NoError(t, err)
	_, err = txA.Exec(ctx, `
		INSERT INTO public.accounts (id, organization_id, account_code, name, account_type)
		VALUES (gen_random_uuid(), $1, '1001', 'Cash Org A', 'ASSET');
	`, orgA)
	require.NoError(t, err)
	require.NoError(t, txA.Commit(ctx))

	// Seed account in Org B under Org B context
	txB, err := conn.Begin(ctx)
	require.NoError(t, err)
	_, err = txB.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true);", userB)
	require.NoError(t, err)
	_, err = txB.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, true);", orgB)
	require.NoError(t, err)
	_, err = txB.Exec(ctx, `
		INSERT INTO public.accounts (id, organization_id, account_code, name, account_type)
		VALUES (gen_random_uuid(), $1, '1001', 'Cash Org B', 'ASSET');
	`, orgB)
	require.NoError(t, err)
	require.NoError(t, txB.Commit(ctx))

	// Test: Under Org A context, User A queries accounts
	txTest, err := conn.Begin(ctx)
	require.NoError(t, err)
	defer txTest.Rollback(ctx)

	_, err = txTest.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true);", userA)
	require.NoError(t, err)
	_, err = txTest.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, true);", orgA)
	require.NoError(t, err)

	// 1. Cross-tenant specific query MUST return 0 rows
	var countCross int
	err = txTest.QueryRow(ctx, "SELECT count(*) FROM public.accounts WHERE organization_id = $1;", orgB).Scan(&countCross)
	require.NoError(t, err)
	assert.Equal(t, 0, countCross, "Cross-tenant SELECT must return 0 rows for another organization")

	// 2. Unfiltered SELECT must ONLY return Org A rows
	rows, err := txTest.Query(ctx, "SELECT organization_id FROM public.accounts;")
	require.NoError(t, err)
	defer rows.Close()

	var returnedOrgs []string
	for rows.Next() {
		var oID string
		require.NoError(t, rows.Scan(&oID))
		returnedOrgs = append(returnedOrgs, oID)
	}
	assert.NotEmpty(t, returnedOrgs)
	for _, oID := range returnedOrgs {
		assert.Equal(t, orgA, oID, "Returned account must strictly belong to current organization")
	}
}

func TestSecurity_CrossTenant_WITH_CHECK_Rejection(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, err = conn.Exec(ctx, "SET ROLE finintel_app;")
	require.NoError(t, err)

	userA, orgA, err := provisionTestUserAndOrg(ctx, conn, "test-issuer", "sub-with-check-a-"+uuid.NewString()[:8], "Org A Check")
	require.NoError(t, err)
	_, orgB, err := provisionTestUserAndOrg(ctx, conn, "test-issuer", "sub-with-check-b-"+uuid.NewString()[:8], "Org B Check")
	require.NoError(t, err)

	tx, err := conn.Begin(ctx)
	require.NoError(t, err)
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true);", userA)
	require.NoError(t, err)
	_, err = tx.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, true);", orgA)
	require.NoError(t, err)

	// Attempt cross-tenant INSERT (organization_id = orgB while GUC is orgA)
	_, err = tx.Exec(ctx, `
		INSERT INTO public.accounts (id, organization_id, account_code, name, account_type)
		VALUES (gen_random_uuid(), $1, '2001', 'Injected Liability', 'LIABILITY');
	`, orgB)
	require.Error(t, err, "Cross-tenant INSERT must be rejected by RLS WITH CHECK")
	var pgErr *pgconn.PgError
	require.True(t, errors.As(err, &pgErr), "Error must be *pgconn.PgError")
	assert.Contains(t, []string{"42501", "44000"}, pgErr.Code, "Cross-tenant INSERT must fail with RLS check violation")
	assert.Contains(t, pgErr.Message, "violates row-level security policy")

	_ = tx.Rollback(ctx)

	// Attempt cross-tenant UPDATE on another organization in fresh transaction
	txUpdate, err := conn.Begin(ctx)
	require.NoError(t, err)
	defer txUpdate.Rollback(ctx)

	_, err = txUpdate.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true);", userA)
	require.NoError(t, err)
	_, err = txUpdate.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, true);", orgA)
	require.NoError(t, err)

	res, err := txUpdate.Exec(ctx, "UPDATE public.accounts SET name = 'Tampered' WHERE organization_id = $1;", orgB)
	require.NoError(t, err)
	assert.Equal(t, int64(0), res.RowsAffected(), "Cross-tenant UPDATE must affect exactly 0 rows")
}

func TestSecurity_GUC_Spoofing_Without_Membership(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, err = conn.Exec(ctx, "SET ROLE finintel_app;")
	require.NoError(t, err)

	userA, _, err := provisionTestUserAndOrg(ctx, conn, "test-issuer", "sub-spoof-a-"+uuid.NewString()[:8], "Org A Spoof")
	require.NoError(t, err)
	userB, orgB, err := provisionTestUserAndOrg(ctx, conn, "test-issuer", "sub-spoof-b-"+uuid.NewString()[:8], "Org B Spoof")
	require.NoError(t, err)

	// Seed account in Org B
	txB, err := conn.Begin(ctx)
	require.NoError(t, err)
	_, err = txB.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true);", userB)
	require.NoError(t, err)
	_, err = txB.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, true);", orgB)
	require.NoError(t, err)
	_, err = txB.Exec(ctx, `
		INSERT INTO public.accounts (id, organization_id, account_code, name, account_type)
		VALUES (gen_random_uuid(), $1, '3001', 'Private Org B Equity', 'EQUITY');
	`, orgB)
	require.NoError(t, err)
	require.NoError(t, txB.Commit(ctx))

	// Attacker User A sets GUC to Org B where User A is NOT a member
	txSpoof, err := conn.Begin(ctx)
	require.NoError(t, err)
	defer txSpoof.Rollback(ctx)

	_, err = txSpoof.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true);", userA)
	require.NoError(t, err)
	_, err = txSpoof.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, true);", orgB)
	require.NoError(t, err)

	// Query accounts: MUST return 0 rows because User A has no membership in Org B
	var count int
	err = txSpoof.QueryRow(ctx, "SELECT count(*) FROM public.accounts;").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "GUC spoofing without membership must yield 0 rows via RLS")

	// Query journal entries: MUST also return 0 rows
	err = txSpoof.QueryRow(ctx, "SELECT count(*) FROM public.journal_entries;").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "GUC spoofing without membership must yield 0 journal entries")
}

func TestSecurity_BFF_Sessions_CRUD(t *testing.T) {
	// Provision a user using app pool
	pool := getTestPool(t)
	ctx := context.Background()
	appConn, err := pool.Acquire(ctx)
	require.NoError(t, err)

	_, err = appConn.Exec(ctx, "SET ROLE finintel_app;")
	require.NoError(t, err)

	var userID string
	err = appConn.QueryRow(ctx, "SELECT id FROM public.fn_provision_user($1, $2, $3, $4);", "bff-issuer", "sub-bff-"+uuid.NewString()[:8], "bff@example.com", "BFF User").Scan(&userID)
	require.NoError(t, err)
	appConn.Release()
	pool.Close()

	// Connect as BFF role
	bffConn := getBFFConn(t)
	defer bffConn.Close(ctx)

	sessionHash := "test_sess_hash_" + uuid.NewString()[:16]

	// 1. CREATE (INSERT)
	var sessionID string
	err = bffConn.QueryRow(ctx, `
		INSERT INTO bff.sessions (
			session_id_hash, user_id, identity_issuer, identity_subject,
			csrf_token_hash, encrypted_access_token,
			access_token_expires_at, idle_expires_at, absolute_expires_at
		) VALUES (
			$1, $2, 'https://auth.finintel.internal', 'ext-sub-test',
			'csrf_hash_123', 'enc_access_token_abc',
			now() + interval '15 minutes', now() + interval '30 minutes', now() + interval '8 hours'
		) RETURNING id;
	`, sessionHash, userID).Scan(&sessionID)
	require.NoError(t, err, "BFF must be able to INSERT into bff.sessions")
	assert.NotEmpty(t, sessionID)

	// 2. READ (SELECT)
	var readUserID, readToken string
	var isRevoked bool
	err = bffConn.QueryRow(ctx, `
		SELECT user_id, encrypted_access_token, is_revoked
		FROM bff.sessions
		WHERE session_id_hash = $1;
	`, sessionHash).Scan(&readUserID, &readToken, &isRevoked)
	require.NoError(t, err, "BFF must be able to SELECT from bff.sessions")
	assert.Equal(t, userID, readUserID)
	assert.Equal(t, "enc_access_token_abc", readToken)
	assert.False(t, isRevoked)

	// 3. UPDATE
	res, err := bffConn.Exec(ctx, `
		UPDATE bff.sessions
		SET is_revoked = TRUE, revoked_at = now()
		WHERE session_id_hash = $1;
	`, sessionHash)
	require.NoError(t, err, "BFF must be able to UPDATE bff.sessions")
	assert.Equal(t, int64(1), res.RowsAffected())

	// 4. DELETE
	delRes, err := bffConn.Exec(ctx, "DELETE FROM bff.sessions WHERE session_id_hash = $1;", sessionHash)
	require.NoError(t, err, "BFF must be able to DELETE from bff.sessions")
	assert.Equal(t, int64(1), delRes.RowsAffected())
}

func TestSecurity_BFF_Denial_From_Public_Tenant_Tables(t *testing.T) {
	bffConn := getBFFConn(t)
	ctx := context.Background()
	defer bffConn.Close(ctx)

	assertBFFDenied := func(t *testing.T, query string, args ...interface{}) {
		_, err := bffConn.Exec(ctx, query, args...)
		require.Error(t, err, "BFF must be denied from tenant table: %s", query)
		var pgErr *pgconn.PgError
		require.True(t, errors.As(err, &pgErr), "Error must be *pgconn.PgError")
		assert.Equal(t, "42501", pgErr.Code, "BFF access to public tenant tables must fail with SQLSTATE 42501 (permission denied)")
	}

	tenantTables := []string{
		"accounts",
		"journal_entries",
		"journal_entry_lines",
		"staged_transactions",
		"fiscal_periods",
		"organization_memberships",
		"audit_logs",
		"organizations",
		"users",
	}

	for _, tbl := range tenantTables {
		t.Run("BFF_Deny_SELECT_"+tbl, func(t *testing.T) {
			assertBFFDenied(t, fmt.Sprintf("SELECT * FROM public.%s LIMIT 1;", tbl))
		})
		t.Run("BFF_Deny_INSERT_"+tbl, func(t *testing.T) {
			assertBFFDenied(t, fmt.Sprintf("INSERT INTO public.%s DEFAULT VALUES;", tbl))
		})
	}
}

func TestSecurity_LastOwner_DemotionRemoval_Protection(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, err = conn.Exec(ctx, "SET ROLE finintel_app;")
	require.NoError(t, err)

	userA, orgA, err := provisionTestUserAndOrg(ctx, conn, "test-issuer", "sub-owner-a-"+uuid.NewString()[:8], "Org Last Owner")
	require.NoError(t, err)

	// Set context as User A, Org A
	_, err = conn.Exec(ctx, "SELECT set_config('app.current_user_id', $1, false);", userA)
	require.NoError(t, err)
	_, err = conn.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, false);", orgA)
	require.NoError(t, err)

	t.Run("Demote sole owner fails", func(t *testing.T) {
		_, err := conn.Exec(ctx, "SELECT public.fn_update_member_role($1, $2, 'ACCOUNTANT', 'corr-demote-1');", orgA, userA)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "CANNOT_REMOVE_LAST_OWNER")
	})

	t.Run("Remove sole owner fails", func(t *testing.T) {
		_, err := conn.Exec(ctx, "SELECT public.fn_remove_member($1, $2, 'corr-remove-1');", orgA, userA)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "CANNOT_REMOVE_LAST_OWNER")
	})

	t.Run("Concurrent final-OWNER demotion protection", func(t *testing.T) {
		// Provision User B and add as co-OWNER
		var userB string
		err := conn.QueryRow(ctx, "SELECT id FROM public.fn_provision_user($1, $2, $3, $4);", "test-issuer", "sub-owner-b-"+uuid.NewString()[:8], "owner-b@example.com", "Owner B").Scan(&userB)
		require.NoError(t, err)

		_, err = conn.Exec(ctx, "SELECT public.fn_add_member($1, $2, 'OWNER', 'corr-add-owner');", orgA, userB)
		require.NoError(t, err)

		// Both User A and User B are now OWNERs.
		// Launch 2 concurrent goroutines attempting to demote each other simultaneously.
		var wg sync.WaitGroup
		var errA, errB error
		wg.Add(2)

		go func() {
			defer wg.Done()
			c, err := pool.Acquire(ctx)
			if err != nil {
				errA = err
				return
			}
			defer c.Release()
			_, _ = c.Exec(ctx, "SET ROLE finintel_app;")
			_, _ = c.Exec(ctx, "SELECT set_config('app.current_user_id', $1, false);", userA)
			_, _ = c.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, false);", orgA)
			_, errA = c.Exec(ctx, "SELECT public.fn_update_member_role($1, $2, 'ACCOUNTANT', 'corr-conc-a');", orgA, userA)
		}()

		go func() {
			defer wg.Done()
			c, err := pool.Acquire(ctx)
			if err != nil {
				errB = err
				return
			}
			defer c.Release()
			_, _ = c.Exec(ctx, "SET ROLE finintel_app;")
			_, _ = c.Exec(ctx, "SELECT set_config('app.current_user_id', $1, false);", userB)
			_, _ = c.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, false);", orgA)
			_, errB = c.Exec(ctx, "SELECT public.fn_update_member_role($1, $2, 'ACCOUNTANT', 'corr-conc-b');", orgA, userB)
		}()

		wg.Wait()

		// At least ONE of the concurrent demotions MUST have failed because the organization can never be left with 0 owners!
		hasFailure := (errA != nil && strings.Contains(errA.Error(), "CANNOT_REMOVE_LAST_OWNER")) ||
			(errB != nil && strings.Contains(errB.Error(), "CANNOT_REMOVE_LAST_OWNER"))
		assert.True(t, hasFailure, "Concurrent demotion must prevent leaving the organization with zero owners (errA: %v, errB: %v)", errA, errB)

		// Dynamically select the user that remained an OWNER
		remainingOwner := userA
		if errA == nil {
			remainingOwner = userB
		}
		_, err = conn.Exec(ctx, "SELECT set_config('app.current_user_id', $1, false);", remainingOwner)
		require.NoError(t, err)
		_, err = conn.Exec(ctx, "SELECT set_config('app.current_organization_id', $1, false);", orgA)
		require.NoError(t, err)

		// Verify via fn_list_organization_members that at least one OWNER still exists
		var ownerCount int
		err = conn.QueryRow(ctx, "SELECT count(*) FROM public.fn_list_organization_members($1) WHERE role = 'OWNER';", orgA).Scan(&ownerCount)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, ownerCount, 1, "Organization must maintain at least one OWNER at all times")
	})
}

func TestSecurity_RuntimeRoles_NotSuperuserOrOwner(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool := getTestPool(t)
	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	_, err = conn.Exec(ctx, "SET ROLE finintel_app;")
	require.NoError(t, err)

	var appIsSuper, appIsBypass bool
	err = conn.QueryRow(ctx, `
		SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'finintel_app';
	`).Scan(&appIsSuper, &appIsBypass)
	require.NoError(t, err)
	assert.False(t, appIsSuper, "finintel_app must NOT be superuser")
	assert.False(t, appIsBypass, "finintel_app must NOT have BYPASSRLS")

	// Table ownership check: finintel_app must NOT own any tables in public or bff
	var ownedTableCount int
	err = conn.QueryRow(ctx, `
		SELECT count(*) FROM pg_tables
		WHERE schemaname IN ('public', 'bff')
		  AND tableowner = 'finintel_app';
	`).Scan(&ownedTableCount)
	require.NoError(t, err)
	assert.Equal(t, 0, ownedTableCount, "finintel_app must NOT own any tables")

	// Check BFF role
	bffConn := getBFFConn(t)
	defer bffConn.Close(ctx)

	_, err = bffConn.Exec(ctx, "SET ROLE finintel_bff;")
	require.NoError(t, err)

	var bffIsSuper, bffIsBypass bool
	err = bffConn.QueryRow(ctx, `
		SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'finintel_bff';
	`).Scan(&bffIsSuper, &bffIsBypass)
	require.NoError(t, err)
	assert.False(t, bffIsSuper, "finintel_bff must NOT be superuser")
	assert.False(t, bffIsBypass, "finintel_bff must NOT have BYPASSRLS")

	var bffOwnedTableCount int
	err = bffConn.QueryRow(ctx, `
		SELECT count(*) FROM pg_tables
		WHERE schemaname IN ('public', 'bff')
		  AND tableowner = 'finintel_bff';
	`).Scan(&bffOwnedTableCount)
	require.NoError(t, err)
	assert.Equal(t, 0, bffOwnedTableCount, "finintel_bff must NOT own any tables")
}
