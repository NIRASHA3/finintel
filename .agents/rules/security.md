# Security & Multi-Tenancy Rules

## 1. Multi-Tenant Data Isolation
- **Organization Scoping**: Every business entity table in PostgreSQL MUST have an `organization_id` column.
- **Query Scoping**: Every database query, join, update, and deletion MUST include `WHERE organization_id = $1`.
- **Membership Verification**: The backend API MUST verify that the authenticated user belongs to the requested `organization_id` before executing any operation. Never trust client-supplied tenant headers or URL parameters without validation.

## 2. Authentication & Authorization
- **Backend-Enforced RBAC**: Role-Based Access Control (RBAC) MUST be enforced in the Go API backend controllers. Frontend checks are for UX only.
- **Roles**: Supported roles are `Owner`, `Administrator`, `Accountant`, `Analyst`, `Auditor/Viewer`, and `System worker`.
- **Least Privilege**: Endpoints must enforce exact role permissions (e.g. only `Accountant` or higher can post journal entries).

## 3. Secret & Credential Protection
- **Zero Secrets in Code**: Password hashes, JWT secrets, database connection strings, and API keys MUST NEVER be committed to Git.
- **Environment Variables**: Read secrets strictly from environment variables or secure secret managers.
- **Configuration Files**: `.env.example` must contain safe placeholders only.

## 4. Logging & Privacy Controls
- **Redaction of Sensitive Data**: Application logs MUST NOT contain:
  - User passwords or hash tokens
  - JWT tokens or session cookies
  - Full credit card / bank account numbers (PAN/IBAN)
  - Raw financial document attachments
  - Personally Identifiable Information (PII) without masking
- **Structured Logging**: All logs must be output in structured JSON format including `correlation_id` and `organization_id`.

## 5. Defense Against Common Vulnerabilities (OWASP)
- **SQL Injection**: Use `sqlc` parameterized queries exclusively. Never construct raw SQL strings via concatenation.
- **Cross-Site Scripting (XSS)**: Next.js automatically escapes rendered JSX content. Sanitize any rich text or user input.
- **CSRF & CORS**: Configure strict CORS headers in Go API allowing only trusted frontend origins (`CORS_ALLOWED_ORIGINS`).
