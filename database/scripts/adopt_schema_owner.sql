-- Database Adoption Script: Schema, Table, Sequence & Function Ownership Transfer
-- Executed on existing databases to transfer ownership of all application objects to finintel_owner.

ALTER SCHEMA public OWNER TO finintel_owner;
GRANT ALL ON SCHEMA public TO finintel_owner;

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Transfer ownership of bff schema if it exists
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'bff') THEN
        EXECUTE 'ALTER SCHEMA bff OWNER TO finintel_owner';
    END IF;

    -- Transfer ownership of known FinIntel application tables in public and bff schemas
    FOR r IN (
        SELECT tablename, schemaname
        FROM pg_tables
        WHERE (schemaname = 'bff' AND tablename = 'sessions')
           OR (schemaname = 'public' AND tablename IN (
               'users', 'organizations', 'organization_memberships', 'accounts',
               'journal_entries', 'journal_entry_lines', 'fiscal_periods',
               'staged_transactions', 'audit_logs', 'idempotency_keys', 'webhooks', 'fx_rates'
           ))
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I OWNER TO finintel_owner', r.schemaname, r.tablename);
    END LOOP;

    -- Transfer ownership of FinIntel sequences (excluding extension-dependent sequences)
    FOR r IN (
        SELECT c.relname AS sequence_name, n.nspname AS sequence_schema
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'S'
          AND n.nspname IN ('public', 'bff')
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = c.oid AND d.deptype = 'e'
          )
    ) LOOP
        EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO finintel_owner', r.sequence_schema, r.sequence_name);
    END LOOP;

    -- Transfer ownership of known FinIntel application functions (excluding extension-owned functions)
    FOR r IN (
        SELECT p.proname, n.nspname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('public', 'bff')
          AND p.proname IN (
              'fn_provision_user',
              'fn_create_organization_with_owner',
              'fn_list_organization_members',
              'fn_add_member',
              'fn_update_member_role',
              'fn_remove_member',
              'fn_cleanup_expired_sessions'
          )
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid AND d.deptype = 'e'
          )
    ) LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) OWNER TO finintel_security_definer', r.nspname, r.proname, r.args);
    END LOOP;
END $$;
