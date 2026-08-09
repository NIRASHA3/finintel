# Security & Multi-Tenancy Rules

## 1. Multi-Tenant Data Isolation
- **Organization Scoping**: Every business entity table in PostgreSQL MUST have an `organization_id` column.
- **Tenant-Safe Composite Foreign Keys**: Relationships between tenant-scoped entities MUST use composite foreign keys `(organization_id, referenced_id)` referencing `(organization_id, id)` on the target table.
- **Query Scoping**: Every database query, join, update, and deletion MUST include `WHERE organization_id = $1`.
- **Membership Verification**: The backend API MUST verify that the authenticated user belongs to the requested `organization_id` before executing any operation.

## 2. Provider-Neutral OIDC Authentication & RBAC
- **Delegated Credentials**: Passwords, MFA, and account recovery are owned by the external OIDC Identity Provider (IdP). Passwords MUST NOT be stored in PostgreSQL.
- **JWKS Verification**: The Go API Resource Server validates incoming Bearer JWT tokens against the IdP's JWKS endpoint, checking issuer (`iss`) and audience (`aud`).
- **Backend-Enforced RBAC**: Roles (`OWNER`, `ADMINISTRATOR`, `ACCOUNTANT`, `ANALYST`, `AUDITOR_VIEWER`) MUST be resolved by mapping OIDC subject claims (`sub`) to `organization_memberships` and enforced in backend API controllers.

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
- **Structured Logging**: All logs must be output in structured JSON format including `correlation_id` and `organization_id`.

## 5. Defense Against Common Vulnerabilities (OWASP)
- **SQL Injection**: Use `sqlc` parameterized queries exclusively. Never construct raw SQL strings via concatenation.
- **Cross-Site Scripting (XSS)**: Next.js automatically escapes rendered JSX content. Sanitize any rich text or user input.
- **CSRF & CORS**: Configure strict CORS headers in Go API allowing only trusted frontend origins (`CORS_ALLOWED_ORIGINS`).
