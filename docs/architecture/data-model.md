# Data Model Specification

## 1. Overview & Multi-Tenant Isolation Pattern
FinIntel employs a single-database, shared-schema multi-tenant model. Multi-tenant isolation is enforced at the database layer through composite primary and foreign keys:

1. Every business entity table MUST contain an `organization_id UUID NOT NULL` column referencing `organizations(id)`.
2. All foreign key constraints between tenant-scoped entities MUST use composite foreign key definitions matching `(organization_id, referenced_entity_id)` against `(organization_id, id)` on the target table. This guarantees that an entity in Tenant A can NEVER reference an account, entry, or staged transaction belonging to Tenant B at the database schema level.

---

## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : "contains"
    USERS ||--o{ ORGANIZATION_MEMBERSHIPS : "has roles in"
    ORGANIZATIONS ||--o{ ACCOUNTS : "owns"
    ORGANIZATIONS ||--o{ JOURNAL_ENTRIES : "posts"
    ORGANIZATIONS ||--o{ JOURNAL_ENTRY_LINES : "contains lines for"
    ORGANIZATIONS ||--o{ STAGED_TRANSACTIONS : "imports"
    ORGANIZATIONS ||--o{ FISCAL_PERIODS : "defines"
    ORGANIZATIONS ||--o{ AUDIT_LOGS : "tracks"

    JOURNAL_ENTRIES ||--|{ JOURNAL_ENTRY_LINES : "contains"
    ACCOUNTS ||--o{ JOURNAL_ENTRY_LINES : "categorizes"
    JOURNAL_ENTRIES ||--o| JOURNAL_ENTRIES : "reverses"
    STAGED_TRANSACTIONS ||--o| JOURNAL_ENTRIES : "posts to"

    ORGANIZATIONS {
        uuid id PK
        string name
        string base_currency
        int fiscal_year_start_month
        timestamp created_at
    }

    USERS {
        uuid id PK
        string external_subject_id UK "OIDC IdP sub claim"
        string email UK
        string full_name
        timestamp created_at
    }

    ORGANIZATION_MEMBERSHIPS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string role
        timestamp joined_at
    }

    ACCOUNTS {
        uuid id PK
        uuid organization_id FK
        string account_code
        string name
        string account_type
        boolean is_active
    }

    JOURNAL_ENTRIES {
        uuid id PK
        uuid organization_id FK
        bigint entry_number
        date transaction_date
        string description
        string status
        uuid reversed_by_entry_id FK
        uuid posted_by_user_id FK
        timestamp created_at
    }

    JOURNAL_ENTRY_LINES {
        uuid id PK
        uuid organization_id FK "Tenant safety composite key"
        uuid journal_entry_id FK
        uuid account_id FK
        bigint debit_amount_minor_units
        bigint credit_amount_minor_units
        string memo
    }

    STAGED_TRANSACTIONS {
        uuid id PK
        uuid organization_id FK
        date transaction_date
        bigint amount_minor_units
        string payee
        string description
        string reference_number
        string suggested_category
        decimal confidence_score
        string ai_explanation
        string status "PENDING_REVIEW, APPROVED, REJECTED"
        uuid posted_journal_entry_id FK
        timestamp created_at
    }

    FISCAL_PERIODS {
        uuid id PK
        uuid organization_id FK
        int fiscal_year
        int period_number
        date start_date
        date end_date
        string status "OPEN, CLOSED, LOCKED"
    }

    AUDIT_LOGS {
        uuid id PK
        uuid organization_id FK
        uuid actor_id FK
        string correlation_id
        string entity_type
        uuid entity_id
        string action
        jsonb changes
        timestamp created_at
    }
```

---

## 3. Core Entity Definitions

### 3.1 `organizations`
- `id` (`UUID`, Primary Key)
- `name` (`VARCHAR(255)`, Not Null)
- `base_currency` (`VARCHAR(3)`, Not Null, e.g. `USD`)
- `fiscal_year_start_month` (`INT`, Default `1`)
- `created_at` (`TIMESTAMPTZ`, Not Null)

### 3.2 `users` (Application Profiles)
- `id` (`UUID`, Primary Key)
- `external_subject_id` (`VARCHAR(255)`, Unique, Not Null - Maps to OIDC IdP `sub` claim)
- `email` (`VARCHAR(255)`, Unique, Not Null)
- `full_name` (`VARCHAR(255)`, Not Null)
- `created_at` (`TIMESTAMPTZ`, Not Null)
- *Note*: Passwords, password hashes, and MFA secrets are NOT stored in PostgreSQL.

### 3.3 `organization_memberships`
- `id` (`UUID`, Primary Key)
- `organization_id` (`UUID`, Foreign Key, references `organizations(id)`)
- `user_id` (`UUID`, Foreign Key, references `users(id)`)
- `role` (`VARCHAR(50)`, Enum: `OWNER`, `ADMINISTRATOR`, `ACCOUNTANT`, `ANALYST`, `AUDITOR_VIEWER`)
- `joined_at` (`TIMESTAMPTZ`, Not Null)
- Unique constraint: `(organization_id, user_id)`

### 3.4 `accounts` (Chart of Accounts)
- `id` (`UUID`, Primary Key)
- `organization_id` (`UUID`, Foreign Key, Indexed)
- `account_code` (`VARCHAR(50)`, Not Null)
- `name` (`VARCHAR(255)`, Not Null)
- `account_type` (`VARCHAR(50)`, Enum: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`)
- `is_active` (`BOOLEAN`, Default `true`)
- Unique composite constraint: `(organization_id, account_code)`
- Unique composite key for foreign keys: `(organization_id, id)`

### 3.5 `journal_entries`
- `id` (`UUID`, Primary Key)
- `organization_id` (`UUID`, Foreign Key, Indexed)
- `entry_number` (`BIGINT`, Monotonically increasing per org)
- `transaction_date` (`DATE`, Not Null)
- `description` (`TEXT`, Not Null)
- `status` (`VARCHAR(20)`, Enum: `DRAFT`, `POSTED`)
- `reversed_by_entry_id` (`UUID`, Foreign Key nullable)
- `posted_by_user_id` (`UUID`, Foreign Key, references `users(id)`)
- Unique composite key for foreign keys: `(organization_id, id)`

### 3.6 `journal_entry_lines`
- `id` (`UUID`, Primary Key)
- `organization_id` (`UUID`, Foreign Key, Indexed)
- `journal_entry_id` (`UUID`, Foreign Key)
- `account_id` (`UUID`, Foreign Key)
- `debit_amount_minor_units` (`BIGINT`, Default 0)
- `credit_amount_minor_units` (`BIGINT`, Default 0)
- `memo` (`TEXT`)
- **Tenant-Safe Composite Foreign Keys**:
  - `FOREIGN KEY (organization_id, journal_entry_id) REFERENCES journal_entries(organization_id, id)`
  - `FOREIGN KEY (organization_id, account_id) REFERENCES accounts(organization_id, id)`

### 3.7 `staged_transactions`
- `id` (`UUID`, Primary Key)
- `organization_id` (`UUID`, Foreign Key, Indexed)
- `transaction_date` (`DATE`, Not Null)
- `amount_minor_units` (`BIGINT`, Not Null)
- `payee` (`VARCHAR(255)`)
- `description` (`TEXT`)
- `reference_number` (`VARCHAR(100)`)
- `suggested_category` (`VARCHAR(255)`)
- `confidence_score` (`NUMERIC(5,4)`, e.g., `0.8500`)
- `ai_explanation` (`TEXT`)
- `status` (`VARCHAR(50)`, Enum: `PENDING_REVIEW`, `APPROVED`, `REJECTED`)
- `posted_journal_entry_id` (`UUID`, Foreign Key nullable)
- `created_at` (`TIMESTAMPTZ`, Not Null)

### 3.8 `fiscal_periods`
- `id` (`UUID`, Primary Key)
- `organization_id` (`UUID`, Foreign Key, Indexed)
- `fiscal_year` (`INT`, Not Null)
- `period_number` (`INT`, Not Null, 1-12)
- `start_date` (`DATE`, Not Null)
- `end_date` (`DATE`, Not Null)
- `status` (`VARCHAR(20)`, Enum: `OPEN`, `CLOSED`, `LOCKED`)
- Unique composite constraint: `(organization_id, fiscal_year, period_number)`

### 3.9 `audit_logs`
- `id` (`UUID`, Primary Key)
- `organization_id` (`UUID`, Foreign Key, Indexed)
- `actor_id` (`UUID`, Foreign Key, references `users(id)`)
- `correlation_id` (`VARCHAR(64)`, Not Null, Indexed)
- `entity_type` (`VARCHAR(100)`, Not Null)
- `entity_id` (`UUID`, Not Null)
- `action` (`VARCHAR(50)`, Enum: `CREATE`, `UPDATE`, `POST`, `REVERSE`, `DELETE`, `LOCK`)
- `changes` (`JSONB`, Detailed before/after delta)
- `created_at` (`TIMESTAMPTZ`, Not Null)

---

## 4. Atomic Mutation & Audit Invariant
Every financial record mutation (posting a journal entry, reversing an entry, locking a period) and its corresponding `audit_logs` record MUST be written **atomically** within a single PostgreSQL transaction block:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 1. Insert or update financial domain record
INSERT INTO journal_entries (...) VALUES (...);
INSERT INTO journal_entry_lines (...) VALUES (...);

-- 2. Insert audit trail event in SAME transaction
INSERT INTO audit_logs (organization_id, actor_id, correlation_id, entity_type, entity_id, action, changes, created_at)
VALUES (...);

COMMIT;
```
If either the domain mutation or audit log insertion fails, the entire transaction rolls back.
