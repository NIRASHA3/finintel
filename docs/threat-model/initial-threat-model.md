# Initial Threat Model (STRIDE Framework)

## 1. Overview & System Assets
FinIntel processes critical financial records, transaction histories, user profile mappings, and machine learning models. This document establishes the threat model using the STRIDE framework to identify security risks and mandatory mitigations.

### Core Assets to Protect
1. **General Ledger Data**: Posted journal entries, chart of accounts, financial reports (High Confidentiality, High Integrity).
2. **Tenant Isolation Boundary**: Cross-tenant data separation (Critical Integrity & Confidentiality).
3. **Identity Tokens**: OIDC ID tokens, access JWTs, service keys (Critical Confidentiality).
4. **Audit Logs**: Immutable history of system and financial mutations (High Integrity & Non-Repudiation).

---

## 2. STRIDE Threat Analysis & Mitigations

### 2.1 Spoofing (Identity Theft & Session Hijacking)
- **Threat**: Attacker impersonates an organization user or system worker using forged tokens or stolen credentials.
- **Impact**: Unauthorized access to tenant financial data.
- **Mitigation**:
  - Delegate authentication to an external OIDC Identity Provider (Auth0/Keycloak/Clerk). Passwords are never stored in PostgreSQL.
  - Verify OIDC access tokens on every API request checking signature against IdP JWKS, issuer (`iss`), audience (`aud`), and token expiration (`exp`).
  - Map user identity using composite uniqueness of issuer plus subject (`(identity_provider_issuer, external_subject_id)`).

### 2.2 Tampering (Data Modification & Financial Corruption)
- **Threat**: Attacker modifies financial journal entries, bypasses debit/credit balance rules, or tampers with accounting period locks.
- **Impact**: Inaccurate ledger, fraudulent financial reporting, corrupted audit records.
- **Mitigation**:
  - Go API enforces database transaction isolation (`SERIALIZABLE`) and debit/credit equality checks ($\sum \text{Debits} = \sum \text{Credits}$).
  - Immutable database constraints: posted entries cannot be UPDATED or DELETED. Reversal entries are required.
  - Financial mutations and corresponding audit log insertions execute **atomically** in the same PostgreSQL transaction block (`BEGIN ... COMMIT`).

### 2.3 Repudiation (Denial of Action)
- **Threat**: Malicious actor posts invalid financial entries or alters configuration and denies performing the action.
- **Impact**: Inability to attribute financial fraud or unauthorized mutations.
- **Mitigation**:
  - Mandatory audit log generated for every mutation capturing `organization_id`, `actor_id` (mapped to OIDC issuer + subject), `actor_type` (`USER`, `SYSTEM_WORKER`, `SERVICE_ACTOR`), `timestamp_utc`, `correlation_id`, and `changes` JSON delta.
  - For service actors and `System Worker` operations where `actor_id` does not reference a human user, `actor_type`, service actor identity, and correlation ID ensure complete traceability without weakening audit requirements.
  - Append-only audit table prevents record modification or deletion.

### 2.4 Information Disclosure (Data Leakage)
- **Threat**: Tenant A accesses Tenant B's ledger data via parameter tampering or unauthenticated endpoints.
- **Impact**: Severe breach of tenant confidentiality and regulatory violation.
- **Mitigation**:
  - Enforce `WHERE organization_id = $1` on 100% of backend database queries.
  - Enforce PostgreSQL Row-Level Security (RLS) as defense-in-depth on all tenant tables, failing closed if organization context is missing. Production DB connection role must not be a superuser, table owner, or possess `BYPASSRLS`. Automated cross-tenant RLS integration tests are mandatory.
  - Enforce composite tenant-safe foreign key constraints `(organization_id, id)` across all tenant-scoped database entities (including self-references and cross-entity references).
  - Go API middleware validates user membership in the target `organization_id` before controller execution.
  - Redact authorization tokens, financial payloads, and PII from application logs.

### 2.5 Denial of Service (Resource Exhaustion)
- **Threat**: Malicious user submits massive CSV files or floods posting endpoints to exhaust API or database connections.
- **Impact**: System slowdown or unavailability for all tenants.
- **Mitigation**:
  - Rate limiting per organization and IP address on Go API router.
  - Restrict CSV file upload size to 50MB and offload parsing to background worker queue (`services/worker`).
  - Configure PostgreSQL max connection bounds (`pgxpool`).

### 2.6 Elevation of Privilege (Unauthorized Role Access)
- **Threat**: User with `Analyst` or `Auditor` role calls posting endpoints directly to create journal entries.
- **Impact**: Unauthorized financial postings.
- **Mitigation**:
  - Enforce Role-Based Access Control (RBAC) in Go API backend controllers for every route.
  - Assert membership role from `organization_memberships` resolved via the validated OIDC issuer (`iss`) and subject claim (`sub`).
