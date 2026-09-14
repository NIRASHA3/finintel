-- +goose Up
-- +goose StatementBegin

-- 1. Assert Migration Identity
DO $$
BEGIN
    IF current_user <> 'finintel_owner' THEN
        RAISE EXCEPTION 'MIGRATION_ROLE_MISMATCH: Migration 00003 must be executed as finintel_owner (current: %)', current_user USING ERRCODE = '42000';
    END IF;
END $$;

-- 2. Schema Ownership & Schema Privileges
ALTER SCHEMA public OWNER TO finintel_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO finintel_app, finintel_bff;
GRANT USAGE, CREATE ON SCHEMA public TO finintel_security_definer;

-- 3. Object Ownership Transfers
ALTER TABLE public.organizations OWNER TO finintel_owner;
ALTER TABLE public.users OWNER TO finintel_owner;
ALTER TABLE public.organization_memberships OWNER TO finintel_owner;
ALTER TABLE public.accounts OWNER TO finintel_owner;
ALTER TABLE public.journal_entries OWNER TO finintel_owner;
ALTER TABLE public.journal_entry_lines OWNER TO finintel_owner;
ALTER TABLE public.staged_transactions OWNER TO finintel_owner;
ALTER TABLE public.fiscal_periods OWNER TO finintel_owner;
ALTER TABLE public.audit_logs OWNER TO finintel_owner;

-- 4. Enable and Force RLS on All Tenant Tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.staged_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staged_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- 5. User Schema Adjustments (Nullable profile fields, drop global unique email constraint)
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS uk_users_email;

-- 6. Create BFF Schema and Sessions Table
CREATE SCHEMA IF NOT EXISTS bff AUTHORIZATION finintel_owner;
GRANT USAGE ON SCHEMA bff TO finintel_bff;

CREATE TABLE bff.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    identity_issuer VARCHAR(512) NOT NULL,
    identity_subject VARCHAR(255) NOT NULL,
    refresh_generation INT NOT NULL DEFAULT 1,
    refresh_claim_id UUID NULL,
    refresh_claimed_at TIMESTAMPTZ NULL,
    csrf_token_hash VARCHAR(64) NOT NULL,
    encrypted_csrf_token TEXT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NULL,
    encrypted_id_token TEXT NULL,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    idle_expires_at TIMESTAMPTZ NOT NULL,
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bff_sessions_hash ON bff.sessions(session_id_hash);
CREATE INDEX idx_bff_sessions_user ON bff.sessions(user_id);
CREATE INDEX idx_bff_sessions_identity ON bff.sessions(identity_issuer, identity_subject);
CREATE INDEX idx_bff_sessions_claimed ON bff.sessions(refresh_claimed_at) WHERE refresh_claimed_at IS NOT NULL;
ALTER TABLE bff.sessions OWNER TO finintel_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON bff.sessions TO finintel_bff;

CREATE TABLE bff.session_token_history (
    session_id_hash VARCHAR(64) PRIMARY KEY,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bff_session_token_history_expiry ON bff.session_token_history(expires_at);
ALTER TABLE bff.session_token_history OWNER TO finintel_owner;
GRANT SELECT, INSERT, DELETE ON bff.session_token_history TO finintel_bff;

-- 7. Table Privileges Allocation for finintel_app & finintel_security_definer
REVOKE INSERT, UPDATE, DELETE ON public.organization_memberships FROM finintel_app;
REVOKE INSERT, UPDATE, DELETE ON public.users FROM finintel_app;
REVOKE INSERT, UPDATE, DELETE ON public.organizations FROM finintel_app;
REVOKE UPDATE, DELETE ON public.audit_logs FROM finintel_app;

GRANT SELECT ON public.organizations TO finintel_app;
GRANT SELECT ON public.organization_memberships TO finintel_app;
GRANT SELECT ON public.users TO finintel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO finintel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO finintel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO finintel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staged_transactions TO finintel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_periods TO finintel_app;
GRANT SELECT, INSERT ON public.audit_logs TO finintel_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO finintel_security_definer;
GRANT SELECT, INSERT, UPDATE ON public.users TO finintel_security_definer;
GRANT SELECT, INSERT, UPDATE ON public.organizations TO finintel_security_definer;
GRANT SELECT, INSERT ON public.audit_logs TO finintel_security_definer;

-- 8. Remove All Legacy Policies from Migration 00001
DROP POLICY IF EXISTS tenant_isolation_org_memberships ON public.organization_memberships;
DROP POLICY IF EXISTS tenant_isolation_accounts ON public.accounts;
DROP POLICY IF EXISTS tenant_isolation_journal_entries ON public.journal_entries;
DROP POLICY IF EXISTS tenant_isolation_journal_entry_lines ON public.journal_entry_lines;
DROP POLICY IF EXISTS tenant_isolation_staged_transactions ON public.staged_transactions;
DROP POLICY IF EXISTS tenant_isolation_fiscal_periods ON public.fiscal_periods;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON public.audit_logs;

-- 9. Replacement Non-Recursive RLS Policies

-- Users: Self-select only
CREATE POLICY user_self_select ON public.users
    FOR SELECT TO finintel_app
    USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Organization Memberships: Self-select only
CREATE POLICY org_memberships_self_select ON public.organization_memberships
    FOR SELECT TO finintel_app
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Organizations: Visible if user has a self-membership row for that org
CREATE POLICY organizations_self_select ON public.organizations
    FOR SELECT TO finintel_app
    USING (id IN (
        SELECT organization_id
        FROM public.organization_memberships
        WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    ));

-- Tenant Business Tables
CREATE POLICY tenant_isolation_accounts ON public.accounts
    FOR ALL TO finintel_app
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.accounts.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.accounts.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );

CREATE POLICY tenant_isolation_journal_entries ON public.journal_entries
    FOR ALL TO finintel_app
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.journal_entries.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.journal_entries.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );

CREATE POLICY tenant_isolation_journal_entry_lines ON public.journal_entry_lines
    FOR ALL TO finintel_app
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.journal_entry_lines.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.journal_entry_lines.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );

CREATE POLICY tenant_isolation_staged_transactions ON public.staged_transactions
    FOR ALL TO finintel_app
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.staged_transactions.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.staged_transactions.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );

CREATE POLICY tenant_isolation_fiscal_periods ON public.fiscal_periods
    FOR ALL TO finintel_app
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.fiscal_periods.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.fiscal_periods.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );

CREATE POLICY tenant_isolation_audit_logs_select ON public.audit_logs
    FOR SELECT TO finintel_app
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.audit_logs.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );

CREATE POLICY tenant_isolation_audit_logs_insert ON public.audit_logs
    FOR INSERT TO finintel_app
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
        AND actor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND actor_type = 'USER'
        AND EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = public.audit_logs.organization_id
              AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );

-- 10. SECURITY DEFINER Stored Functions

-- User Provisioning
CREATE OR REPLACE FUNCTION public.fn_provision_user(
    _issuer VARCHAR(255),
    _subject VARCHAR(255),
    _email VARCHAR(255),
    _full_name VARCHAR(255)
) RETURNS TABLE (
    id UUID,
    identity_provider_issuer VARCHAR(255),
    external_subject_id VARCHAR(255),
    email VARCHAR(255),
    full_name VARCHAR(255),
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
#variable_conflict use_column
BEGIN
    IF _issuer IS NULL OR length(trim(_issuer)) = 0 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Issuer is required' USING ERRCODE = '22023';
    END IF;
    IF _subject IS NULL OR length(trim(_subject)) = 0 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Subject is required' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    INSERT INTO public.users (
        identity_provider_issuer,
        external_subject_id,
        email,
        full_name
    ) VALUES (
        _issuer,
        _subject,
        _email,
        _full_name
    )
    ON CONFLICT (identity_provider_issuer, external_subject_id)
    DO UPDATE SET
        email = COALESCE(EXCLUDED.email, users.email),
        full_name = COALESCE(EXCLUDED.full_name, users.full_name)
    RETURNING users.id, users.identity_provider_issuer, users.external_subject_id, users.email, users.full_name, users.created_at;
END;
$$;

ALTER FUNCTION public.fn_provision_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR) OWNER TO finintel_security_definer;
REVOKE ALL ON FUNCTION public.fn_provision_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_provision_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO finintel_app;

-- Organization Creation with Owner
CREATE OR REPLACE FUNCTION public.fn_create_organization_with_owner(
    _name VARCHAR(255),
    _base_currency VARCHAR(3),
    _fiscal_year_start_month INT,
    _correlation_id VARCHAR(64)
) RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_org public.organizations%ROWTYPE;
BEGIN
    v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: app.current_user_id is not set' USING ERRCODE = '42000';
    END IF;

    IF _name IS NULL OR length(trim(_name)) = 0 OR length(_name) > 255 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Organization name must be 1-255 chars' USING ERRCODE = '22023';
    END IF;

    IF _base_currency IS NULL OR _base_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'INVALID_INPUT: Base currency must be 3 uppercase letters' USING ERRCODE = '22023';
    END IF;

    IF _fiscal_year_start_month IS NULL OR _fiscal_year_start_month NOT BETWEEN 1 AND 12 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Fiscal start month must be 1-12' USING ERRCODE = '22023';
    END IF;

    IF _correlation_id IS NULL OR length(trim(_correlation_id)) = 0 OR length(_correlation_id) > 64 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Correlation ID must be 1-64 chars' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.organizations (name, base_currency, fiscal_year_start_month)
    VALUES (trim(_name), _base_currency, _fiscal_year_start_month)
    RETURNING * INTO v_org;

    INSERT INTO public.organization_memberships (organization_id, user_id, role)
    VALUES (v_org.id, v_actor_id, 'OWNER');

    INSERT INTO public.audit_logs (
        organization_id, actor_id, actor_type, correlation_id,
        entity_type, entity_id, action, changes
    ) VALUES (
        v_org.id, v_actor_id, 'USER', _correlation_id,
        'ORGANIZATION', v_org.id, 'CREATE',
        jsonb_build_object('name', v_org.name, 'base_currency', v_org.base_currency)
    );

    RETURN v_org;
END;
$$;

ALTER FUNCTION public.fn_create_organization_with_owner(VARCHAR, VARCHAR, INT, VARCHAR) OWNER TO finintel_security_definer;
REVOKE ALL ON FUNCTION public.fn_create_organization_with_owner(VARCHAR, VARCHAR, INT, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_create_organization_with_owner(VARCHAR, VARCHAR, INT, VARCHAR) TO finintel_app;

-- Add Member
CREATE OR REPLACE FUNCTION public.fn_add_member(
    _org_id UUID,
    _target_user_id UUID,
    _role VARCHAR(50),
    _correlation_id VARCHAR(64)
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_current_org_id UUID;
    v_actor_role VARCHAR(50);
    v_membership_id UUID;
BEGIN
    v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: app.current_user_id is not set' USING ERRCODE = '42000';
    END IF;

    v_current_org_id := NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
    IF v_current_org_id IS NULL OR v_current_org_id <> _org_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Session scope mismatch' USING ERRCODE = '42001';
    END IF;

    IF _role NOT IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'ANALYST', 'AUDITOR_VIEWER') THEN
        RAISE EXCEPTION 'INVALID_ROLE: Role % is invalid', _role USING ERRCODE = '22023';
    END IF;

    IF _correlation_id IS NULL OR length(trim(_correlation_id)) = 0 OR length(_correlation_id) > 64 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Correlation ID must be 1-64 chars' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.organizations WHERE id = _org_id FOR UPDATE;

    SELECT role INTO v_actor_role
    FROM public.organization_memberships
    WHERE organization_id = _org_id AND user_id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Actor is not a member' USING ERRCODE = '42501';
    ELSIF v_actor_role = 'ADMINISTRATOR' THEN
        IF _role IN ('OWNER', 'ADMINISTRATOR') THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: ADMINISTRATOR cannot assign role %', _role USING ERRCODE = '42501';
        END IF;
    ELSIF v_actor_role <> 'OWNER' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % cannot add members', v_actor_role USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.organization_memberships (organization_id, user_id, role)
    VALUES (_org_id, _target_user_id, _role)
    RETURNING id INTO v_membership_id;

    INSERT INTO public.audit_logs (
        organization_id, actor_id, actor_type, correlation_id,
        entity_type, entity_id, action, changes
    ) VALUES (
        _org_id, v_actor_id, 'USER', _correlation_id,
        'ORGANIZATION_MEMBERSHIP', v_membership_id, 'CREATE',
        jsonb_build_object('assigned_role', _role, 'target_user_id', _target_user_id)
    );
END;
$$;

ALTER FUNCTION public.fn_add_member(UUID, UUID, VARCHAR, VARCHAR) OWNER TO finintel_security_definer;
REVOKE ALL ON FUNCTION public.fn_add_member(UUID, UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_add_member(UUID, UUID, VARCHAR, VARCHAR) TO finintel_app;

-- Update Member Role
CREATE OR REPLACE FUNCTION public.fn_update_member_role(
    _org_id UUID,
    _target_user_id UUID,
    _new_role VARCHAR(50),
    _correlation_id VARCHAR(64)
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_current_org_id UUID;
    v_actor_role VARCHAR(50);
    v_old_role VARCHAR(50);
    v_membership_id UUID;
    v_owner_count INT;
BEGIN
    v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: app.current_user_id is not set' USING ERRCODE = '42000';
    END IF;

    v_current_org_id := NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
    IF v_current_org_id IS NULL OR v_current_org_id <> _org_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Session scope mismatch' USING ERRCODE = '42001';
    END IF;

    IF _new_role NOT IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'ANALYST', 'AUDITOR_VIEWER') THEN
        RAISE EXCEPTION 'INVALID_ROLE: Role % is invalid', _new_role USING ERRCODE = '22023';
    END IF;

    IF _correlation_id IS NULL OR length(trim(_correlation_id)) = 0 OR length(_correlation_id) > 64 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Correlation ID must be 1-64 chars' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.organizations WHERE id = _org_id FOR UPDATE;

    SELECT role INTO v_actor_role
    FROM public.organization_memberships
    WHERE organization_id = _org_id AND user_id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Actor is not a member' USING ERRCODE = '42501';
    END IF;

    SELECT id, role INTO v_membership_id, v_old_role
    FROM public.organization_memberships
    WHERE organization_id = _org_id AND user_id = _target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND: User % is not in org %', _target_user_id, _org_id USING ERRCODE = 'P0002';
    END IF;

    IF v_actor_role = 'ADMINISTRATOR' THEN
        IF v_old_role IN ('OWNER', 'ADMINISTRATOR') OR _new_role IN ('OWNER', 'ADMINISTRATOR') THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: ADMINISTRATOR cannot manage OWNER or ADMINISTRATOR roles' USING ERRCODE = '42501';
        END IF;
    ELSIF v_actor_role <> 'OWNER' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % cannot update member roles', v_actor_role USING ERRCODE = '42501';
    END IF;

    IF v_old_role = 'OWNER' AND _new_role <> 'OWNER' THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.organization_memberships
        WHERE organization_id = _org_id AND role = 'OWNER';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'CANNOT_REMOVE_LAST_OWNER: Organization must retain at least one OWNER' USING ERRCODE = '23514';
        END IF;
    END IF;

    UPDATE public.organization_memberships
    SET role = _new_role
    WHERE id = v_membership_id;

    INSERT INTO public.audit_logs (
        organization_id, actor_id, actor_type, correlation_id,
        entity_type, entity_id, action, changes
    ) VALUES (
        _org_id, v_actor_id, 'USER', _correlation_id,
        'ORGANIZATION_MEMBERSHIP', v_membership_id, 'UPDATE',
        jsonb_build_object('old_role', v_old_role, 'new_role', _new_role, 'target_user_id', _target_user_id)
    );
END;
$$;

ALTER FUNCTION public.fn_update_member_role(UUID, UUID, VARCHAR, VARCHAR) OWNER TO finintel_security_definer;
REVOKE ALL ON FUNCTION public.fn_update_member_role(UUID, UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_update_member_role(UUID, UUID, VARCHAR, VARCHAR) TO finintel_app;

-- Remove Member
CREATE OR REPLACE FUNCTION public.fn_remove_member(
    _org_id UUID,
    _target_user_id UUID,
    _correlation_id VARCHAR(64)
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_current_org_id UUID;
    v_actor_role VARCHAR(50);
    v_old_role VARCHAR(50);
    v_membership_id UUID;
    v_owner_count INT;
BEGIN
    v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: app.current_user_id is not set' USING ERRCODE = '42000';
    END IF;

    v_current_org_id := NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
    IF v_current_org_id IS NULL OR v_current_org_id <> _org_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Session scope mismatch' USING ERRCODE = '42001';
    END IF;

    IF _correlation_id IS NULL OR length(trim(_correlation_id)) = 0 OR length(_correlation_id) > 64 THEN
        RAISE EXCEPTION 'INVALID_INPUT: Correlation ID must be 1-64 chars' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.organizations WHERE id = _org_id FOR UPDATE;

    SELECT role INTO v_actor_role
    FROM public.organization_memberships
    WHERE organization_id = _org_id AND user_id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Actor is not a member' USING ERRCODE = '42501';
    END IF;

    SELECT id, role INTO v_membership_id, v_old_role
    FROM public.organization_memberships
    WHERE organization_id = _org_id AND user_id = _target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_actor_role = 'ADMINISTRATOR' THEN
        IF v_old_role IN ('OWNER', 'ADMINISTRATOR') THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: ADMINISTRATOR cannot remove OWNER or ADMINISTRATOR' USING ERRCODE = '42501';
        END IF;
    ELSIF v_actor_role <> 'OWNER' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % cannot remove members', v_actor_role USING ERRCODE = '42501';
    END IF;

    IF v_old_role = 'OWNER' THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.organization_memberships
        WHERE organization_id = _org_id AND role = 'OWNER';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'CANNOT_REMOVE_LAST_OWNER: Cannot delete the last OWNER' USING ERRCODE = '23514';
        END IF;
    END IF;

    DELETE FROM public.organization_memberships
    WHERE id = v_membership_id;

    INSERT INTO public.audit_logs (
        organization_id, actor_id, actor_type, correlation_id,
        entity_type, entity_id, action, changes
    ) VALUES (
        _org_id, v_actor_id, 'USER', _correlation_id,
        'ORGANIZATION_MEMBERSHIP', v_membership_id, 'DELETE',
        jsonb_build_object('removed_role', v_old_role, 'target_user_id', _target_user_id)
    );
END;
$$;

ALTER FUNCTION public.fn_remove_member(UUID, UUID, VARCHAR) OWNER TO finintel_security_definer;
REVOKE ALL ON FUNCTION public.fn_remove_member(UUID, UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_remove_member(UUID, UUID, VARCHAR) TO finintel_app;

-- Authorized Member Listing (SECURITY DEFINER to project user info safely)
CREATE OR REPLACE FUNCTION public.fn_list_organization_members(
    _org_id UUID
) RETURNS TABLE (
    membership_id UUID,
    user_id UUID,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50),
    joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_current_org_id UUID;
    v_actor_role VARCHAR(50);
BEGIN
    v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: app.current_user_id is not set' USING ERRCODE = '42000';
    END IF;

    v_current_org_id := NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
    IF v_current_org_id IS NULL OR v_current_org_id <> _org_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Session scope mismatch' USING ERRCODE = '42001';
    END IF;

    SELECT m.role INTO v_actor_role
    FROM public.organization_memberships m
    WHERE m.organization_id = _org_id AND m.user_id = v_actor_id;

    IF v_actor_role IS NULL OR v_actor_role NOT IN ('OWNER', 'ADMINISTRATOR') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Only OWNER or ADMINISTRATOR can list organization members' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        m.id AS membership_id,
        u.id AS user_id,
        u.email,
        u.full_name,
        m.role,
        m.joined_at
    FROM public.organization_memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE m.organization_id = _org_id
    ORDER BY m.joined_at ASC;
END;
$$;

ALTER FUNCTION public.fn_list_organization_members(UUID) OWNER TO finintel_security_definer;
REVOKE ALL ON FUNCTION public.fn_list_organization_members(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_list_organization_members(UUID) TO finintel_app;

-- Revoke temporary CREATE privilege from finintel_security_definer after function creation
REVOKE CREATE ON SCHEMA public FROM finintel_security_definer;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    RAISE EXCEPTION 'SECURITY_MIGRATION_IRREVERSIBLE: Migration 00003 is forward-only. Test resets must recreate the database.' USING ERRCODE = '55000';
END $$;
-- +goose StatementEnd
