# Initial Threat Model (STRIDE Framework) - Track 1 Security Hardened

## 1. Overview & System Assets
FinIntel processes critical financial records, transaction histories, user profile mappings, and executive dashboards. This document establishes the threat model using the STRIDE framework to identify security risks and mandatory Track 1 security hardening mitigations.

### Core Assets to Protect
1. **General Ledger Data**: Posted journal entries, chart of accounts, financial reports (High Confidentiality, High Integrity).
2. **Tenant Isolation Boundary**: Cross-tenant data separation (Critical Integrity & Confidentiality).
3. **Identity Tokens & Session Secret**: OIDC ID tokens, access JWTs, BFF encrypted session tokens, CSRF tokens (Critical Confidentiality).
4. **Audit Logs**: Immutable history of system and financial mutations (High Integrity & Non-Repudiation).

---

## 2. STRIDE Threat Analysis & Mitigations

### 2.1 Spoofing (Identity Theft & Session Hijacking)
- **Threat**: Attacker impersonates an organization user or system worker using forged tokens, stolen cookies, or header injection.
- **Impact**: Unauthorized access to tenant financial data.
- **Mitigation**:
  - Delegate authentication to an external OIDC Identity Provider (Auth0/Keycloak/Clerk). Cryptographically verify OIDC JWT signature, issuer, audience, expiry, `nbf`, and non-empty `sub`.
  - Next.js BFF issues opaque 32-byte session tokens in `__Host-finintel_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`). Tokens in browser storage, URL params, or JavaScript are strictly prohibited.
  - BFF encrypts access, refresh, and ID tokens using AES-256-GCM with unique 12-byte random nonces and AAD binding (`sessionID:userID:tokenType:keyVersion`).
  - Core API connection pool role executes `SET ROLE finintel_app; SELECT current_user, session_user;` on every new connection. User identity is derived in PostgreSQL from `app.current_user_id`.

### 2.2 Tampering (Data Modification & Financial Corruption)
- **Threat**: Attacker modifies financial journal entries, tampers with member roles, or bypasses debit/credit balance rules.
- **Impact**: Inaccurate ledger, fraudulent financial reporting, corrupted audit records.
- **Mitigation**:
  - Direct DML (`INSERT`, `UPDATE`, `DELETE`) on `users`, `organizations`, and `organization_memberships` is revoked from `finintel_app`. Mutations run exclusively via `SECURITY DEFINER` stored functions owned by `finintel_security_definer` with fixed `search_path = pg_catalog, public, pg_temp`.
  - Immutable database constraints: posted journal entries cannot be UPDATED or DELETED. Reversal entries are required.
  - Per-organization advisory locking (`pg_advisory_xact_lock`) prevents race conditions during member role updates and ensures the final `OWNER` cannot be demoted or removed under concurrent requests.
  - CSRF protection: state-changing BFF operations require header `X-FinIntel-CSRF` matching constant-time SHA-256 hashes (`crypto.timingSafeEqual`).

### 2.3 Repudiation (Denial of Action)
- **Threat**: Malicious actor posts invalid financial entries or alters configuration and denies performing the action.
- **Impact**: Inability to attribute financial fraud or unauthorized mutations.
- **Mitigation**:
  - Audit log table `audit_logs` is append-only with forced RLS. Direct `UPDATE` and `DELETE` privileges are revoked from `finintel_app`.
  - Privileged functions derive actor identity directly from `app.current_user_id` context and require correlation ID.

### 2.4 Information Disclosure (Data Leakage)
- **Threat**: Tenant A accesses Tenant B's ledger data via parameter tampering, path traversal, or unauthenticated endpoints.
- **Impact**: Severe breach of tenant confidentiality and regulatory violation.
- **Mitigation**:
  - Row-Level Security (RLS) is ENABLED and FORCED on all 9 tenant tables (`organizations`, `users`, `organization_memberships`, `accounts`, `journal_entries`, `journal_entry_lines`, `staged_transactions`, `fiscal_periods`, `audit_logs`).
  - Tenant business tables enforce non-recursive authorization: `row.organization_id = app.current_organization_id` AND active membership exists in `organization_memberships` for `app.current_user_id`.
  - Next.js proxy route applies single-decode path validation, rejecting double encoding (`%25`), encoded slashes (`%2F`, `%5C`), control characters, null bytes, and dot segments (`..`).
  - Next.js proxy strips browser `Authorization`, `X-User-ID`, `X-User-Role`, and `X-Organization-ID` headers before proxying requests upstream.

### 2.5 Denial of Service (Resource Exhaustion)
- **Threat**: Malicious user submits massive payloads or floods endpoints to exhaust API or database connections.
- **Impact**: System slowdown or unavailability for all tenants.
- **Mitigation**:
  - Rate limiting (100 req/sec, burst 200) on Go API router and response buffering limit.
  - Health endpoint `/health/live` returns 200; `/health/ready` verifies PostgreSQL connection and returns 503 on dependency outage without crashing process.

### 2.6 Elevation of Privilege (Unauthorized Role Access)
- **Threat**: User with `AUDITOR_VIEWER` or `ANALYST` role calls posting endpoints directly to create journal entries or alter member roles.
- **Impact**: Unauthorized financial postings.
- **Mitigation**:
  - Canonical 5 roles enforced: `OWNER`, `ADMINISTRATOR`, `ACCOUNTANT`, `ANALYST`, `AUDITOR_VIEWER`.
  - Go Chi router enforces exact method-plus-route RBAC table using database-derived role context attached during `TenantScopedTxMiddleware`. Missing or invalid role context returns 403.
  - Inside PostgreSQL, `ADMINISTRATOR` is explicitly restricted from assigning, modifying, or removing `OWNER` or `ADMINISTRATOR` roles.
