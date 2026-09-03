-- +goose Up
-- +goose StatementBegin

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    fiscal_year_start_month INT NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_organizations_id UNIQUE (id)
);

-- 2. USERS (Application Profiles - Passwords stored in OIDC IdP, not PostgreSQL)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_provider_issuer VARCHAR(255) NOT NULL,
    external_subject_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_idp_sub UNIQUE (identity_provider_issuer, external_subject_id)
);

-- 3. ORGANIZATION_MEMBERSHIPS
CREATE TABLE organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'ANALYST', 'AUDITOR_VIEWER')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_org_memberships_org_user UNIQUE (organization_id, user_id),
    CONSTRAINT uk_org_memberships_org_id UNIQUE (organization_id, id)
);

CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);

-- 4. ACCOUNTS (Chart of Accounts)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uk_accounts_org_code UNIQUE (organization_id, account_code),
    CONSTRAINT uk_accounts_org_id UNIQUE (organization_id, id)
);

CREATE INDEX idx_accounts_org ON accounts(organization_id);

-- 5. JOURNAL_ENTRIES
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entry_number BIGINT NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED')),
    reversed_by_entry_id UUID NULL,
    posted_by_user_id UUID NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_journal_entries_org_id UNIQUE (organization_id, id),
    CONSTRAINT uk_journal_entries_org_entry_num UNIQUE (organization_id, entry_number),
    CONSTRAINT fk_journal_entries_reversed_by FOREIGN KEY (organization_id, reversed_by_entry_id) REFERENCES journal_entries(organization_id, id)
);

CREATE INDEX idx_journal_entries_org_date ON journal_entries(organization_id, transaction_date);

-- 6. JOURNAL_ENTRY_LINES
CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL,
    account_id UUID NOT NULL,
    debit_amount_minor_units BIGINT NOT NULL DEFAULT 0 CHECK (debit_amount_minor_units >= 0),
    credit_amount_minor_units BIGINT NOT NULL DEFAULT 0 CHECK (credit_amount_minor_units >= 0),
    memo TEXT NULL,
    CONSTRAINT fk_jel_journal_entry FOREIGN KEY (organization_id, journal_entry_id) REFERENCES journal_entries(organization_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_jel_account FOREIGN KEY (organization_id, account_id) REFERENCES accounts(organization_id, id),
    CONSTRAINT chk_jel_debit_credit_xor CHECK ((debit_amount_minor_units > 0 AND credit_amount_minor_units = 0) OR (credit_amount_minor_units > 0 AND debit_amount_minor_units = 0))
);

CREATE INDEX idx_jel_org_entry ON journal_entry_lines(organization_id, journal_entry_id);
CREATE INDEX idx_jel_org_account ON journal_entry_lines(organization_id, account_id);

-- 7. STAGED_TRANSACTIONS
CREATE TABLE staged_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    amount_minor_units BIGINT NOT NULL,
    payee VARCHAR(255) NULL,
    description TEXT NULL,
    reference_number VARCHAR(100) NULL,
    suggested_category VARCHAR(255) NULL,
    confidence_score NUMERIC(5,4) NULL CHECK (confidence_score BETWEEN 0 AND 1),
    ai_explanation TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
    posted_journal_entry_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_staged_transactions_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_staged_tx_posted_entry FOREIGN KEY (organization_id, posted_journal_entry_id) REFERENCES journal_entries(organization_id, id)
);

CREATE INDEX idx_staged_tx_org_status ON staged_transactions(organization_id, status);

-- 8. FISCAL_PERIODS
CREATE TABLE fiscal_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
    CONSTRAINT uk_fiscal_periods_org_year_period UNIQUE (organization_id, fiscal_year, period_number),
    CONSTRAINT uk_fiscal_periods_org_id UNIQUE (organization_id, id)
);

CREATE INDEX idx_fiscal_periods_org_status ON fiscal_periods(organization_id, status);

-- 9. AUDIT_LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID NULL REFERENCES users(id),
    actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('USER', 'SYSTEM_WORKER', 'SERVICE_ACTOR')),
    correlation_id VARCHAR(64) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'POST', 'REVERSE', 'DELETE', 'LOCK')),
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_audit_logs_org_id UNIQUE (organization_id, id)
);

CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_correlation ON audit_logs(correlation_id);

-- ROW-LEVEL SECURITY (RLS) DEFENSE-IN-DEPTH
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE staged_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_org_memberships ON organization_memberships
    FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

CREATE POLICY tenant_isolation_accounts ON accounts
    FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

CREATE POLICY tenant_isolation_journal_entries ON journal_entries
    FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

CREATE POLICY tenant_isolation_journal_entry_lines ON journal_entry_lines
    FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

CREATE POLICY tenant_isolation_staged_transactions ON staged_transactions
    FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

CREATE POLICY tenant_isolation_fiscal_periods ON fiscal_periods
    FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation_fiscal_periods ON fiscal_periods;
DROP POLICY IF EXISTS tenant_isolation_staged_transactions ON staged_transactions;
DROP POLICY IF EXISTS tenant_isolation_journal_entry_lines ON journal_entry_lines;
DROP POLICY IF EXISTS tenant_isolation_journal_entries ON journal_entries;
DROP POLICY IF EXISTS tenant_isolation_accounts ON accounts;
DROP POLICY IF EXISTS tenant_isolation_org_memberships ON organization_memberships;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS fiscal_periods;
DROP TABLE IF EXISTS staged_transactions;
DROP TABLE IF EXISTS journal_entry_lines;
DROP TABLE IF EXISTS journal_entries;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS organization_memberships;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

-- +goose StatementEnd
