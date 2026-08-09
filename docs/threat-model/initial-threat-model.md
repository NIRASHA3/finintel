# Initial Threat Model (STRIDE Framework)

## 1. Overview & System Assets
FinIntel processes critical financial records, transaction histories, user credentials, and machine learning models. This document establishes the threat model using the STRIDE framework to identify security risks and mandatory mitigations.

### Core Assets to Protect
1. **General Ledger Data**: Posted journal entries, chart of accounts, financial reports (High Confidentiality, High Integrity).
2. **Tenant Isolation Boundary**: Cross-tenant data separation (Critical Integrity & Confidentiality).
3. **Authentication Secrets**: User password hashes, JWT signing keys, session tokens (Critical Confidentiality).
4. **Audit Logs**: Immutable history of system and financial mutations (High Integrity & Non-Repudiation).

---

## 2. STRIDE Threat Analysis & Mitigations

### 2.1 Spoofing (Identity Theft & Session Hijacking)
- **Threat**: Attacker impersonates an organization user or system worker to gain unauthorized access.
- **Impact**: Unauthorized access to tenant financial data.
- **Mitigation**:
  - Enforce Argon2id / bcrypt password hashing with MFA TOTP support.
  - Issue short-lived JWT access tokens (15 min) with HTTP-only, secure, SameSite refresh cookies.
  - Sign JWTs using strong 256-bit secret keys (`JWT_SECRET_KEY`).

### 2.2 Tampering (Data Modification & Financial Corruption)
- **Threat**: Attacker modifies financial journal entries, bypasses debit/credit balance rules, or tampers with accounting period locks.
- **Impact**: Inaccurate ledger, fraudulent financial reporting, corrupted audit records.
- **Mitigation**:
  - Go API enforces database transaction isolation (`SERIALIZABLE`) and debit/credit equality checks ($\sum \text{Debits} = \sum \text{Credits}$).
  - Immutable database constraints: posted entries cannot be UPDATED or DELETED. Reversal entries are required.
  - Application checks fiscal period lock status before executing inserts.

### 2.3 Repudiation (Denial of Action)
- **Threat**: Malicious actor posts invalid financial entries or alters configuration and denies performing the action.
- **Impact**: Inability to attribute financial fraud or unauthorized mutations.
- **Mitigation**:
  - Mandatory audit log generated for every mutation capturing `organization_id`, `actor_id`, `timestamp_utc`, `correlation_id`, and `changes` JSON delta.
  - Append-only audit table prevents record modification or deletion.

### 2.4 Information Disclosure (Data Leakage)
- **Threat**: Tenant A accesses Tenant B's ledger data via parameter tampering or unauthenticated endpoints.
- **Impact**: Severe breach of tenant confidentiality and regulatory violation.
- **Mitigation**:
  - Enforce `WHERE organization_id = $1` on 100% of database queries.
  - Go API middleware validates user membership in the target `organization_id` before controller execution.
  - Redact passwords, tokens, full credit card numbers, and PII from application logs.

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
  - Frontend UI hiding of actions is supplemented by strict backend role assertion.
