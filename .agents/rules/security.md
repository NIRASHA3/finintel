# Security & Multi-Tenancy Rules

## 1. Multi-Tenant Data Isolation
- **Organization Scoping**: Every business entity table in PostgreSQL MUST have an `organization_id` column.
- **Tenant-Safe Composite Foreign Keys**: Relationships between tenant-scoped entities MUST use composite foreign keys `(organization_id, referenced_id)` referencing `(organization_id, id)` on the target table.
  - Referenced tenant tables MUST define explicit `UNIQUE (organization_id, id)` constraints to serve as foreign key targets.
  - Composite foreign keys strictly prevent cross-organization entity references at the database schema layer.
  - Self-references MUST be composite tenant-safe (e.g. `journal_entries.reversed_by_entry_id` uses `FOREIGN KEY (organization_id, reversed_by_entry_id) REFERENCES journal_entries(organization_id, id)`).
  - Cross-entity tenant references MUST be composite (e.g. `staged_transactions.posted_journal_entry_id` uses `FOREIGN KEY (organization_id, posted_journal_entry_id) REFERENCES journal_entries(organization_id, id)`).
- **Query Scoping**: Every database query, join, update, and deletion MUST include `WHERE organization_id = $1`.
- **PostgreSQL Row-Level Security (RLS) Defense-in-Depth**:
  - PostgreSQL Row-Level Security (RLS) MUST be enabled on all tenant-scoped tables as a defense-in-depth layer supplementing mandatory backend application `organization_id` filtering.
  - Tenant RLS policies MUST fail closed by default if the organization session context/variable is missing or invalid.
  - The production application database connection role MUST NOT be a superuser, table owner, or hold `BYPASSRLS` privileges.
  - Automated cross-tenant RLS integration tests are mandatory in the test suite.
- **Membership Verification**: The backend API MUST verify that the authenticated user belongs to the requested `organization_id` before executing any operation.

## 2. Provider-Neutral OIDC Authentication & RBAC
- **Delegated Credentials**: Passwords, MFA, and account recovery are owned by the external OIDC Identity Provider (IdP). Passwords MUST NOT be stored in PostgreSQL.
- **Issuer + Subject Identity Uniqueness**: OIDC identities MUST be uniquely identified by issuer plus subject (`(identity_provider_issuer, external_subject_id)` composite uniqueness) to support multi-provider / enterprise federation setups unless the system permanently supports only one issuer.
- **JWKS Verification**: The Go API Resource Server validates incoming Bearer JWT tokens against the IdP's JWKS endpoint, checking issuer (`iss`) and audience (`aud`).
- **Backend-Enforced RBAC**: Roles (`OWNER`, `ADMINISTRATOR`, `ACCOUNTANT`, `ANALYST`, `AUDITOR_VIEWER`) MUST be resolved by mapping OIDC issuer plus subject claims to `organization_memberships` and enforced in backend API controllers.

## 3. Secret & Credential Protection
- **Zero Secrets in Code**: Password hashes, JWT secrets, database connection strings, and API keys MUST NEVER be committed to Git.
- **Environment Variables**: Read secrets strictly from environment variables or secure secret managers.
- **Configuration Files**: `.env.example` must contain safe placeholders only.

## 4. Logging & Privacy Controls
- **Redaction of Sensitive Data**: Application logs MUST NOT contain:
  - Authorization tokens or session cookies
  - Full credit card / bank account numbers (PAN/IBAN)
  - Raw financial document attachments
  - Personally Identifiable Information (PII) without masking
- **Structured Logging & Service Actor Audit Traceability**:
  - All logs must be output in structured JSON format including `correlation_id` and `organization_id`.
  - Financial mutations and operational events captured in `audit_logs` MUST represent both human users (mapped via user ID) and non-human service actors / System Worker operations (`services/worker`).
  - When `actor_id` does not reference a human user, the audit trail MUST capture the service actor identifier / type alongside correlation ID and organization context without weakening audit traceability or non-repudiation.

## 5. Defense Against Common Vulnerabilities (OWASP)
- **SQL Injection**: Use `sqlc` parameterized queries exclusively. Never construct raw SQL strings via concatenation.
- **Cross-Site Scripting (XSS)**: Next.js automatically escapes rendered JSX content. Sanitize any rich text or user input.
- **CSRF & CORS**: Configure strict CORS headers in Go API allowing only trusted frontend origins (`CORS_ALLOWED_ORIGINS`).
