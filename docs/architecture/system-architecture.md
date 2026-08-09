# System Architecture Specification

## 1. Executive Summary
FinIntel is designed as a multi-tenant, modular monolith financial operations platform. It combines a Next.js web application frontend (`apps/web`), a Go core REST API engine (`services/api`), a Go background worker (`services/worker`), and a Python advisory intelligence service (`services/intelligence`) backed by PostgreSQL and an external OIDC Identity Provider.

---

## 2. High-Level System Architecture (C4 Component Model)

```mermaid
graph TD
    Client["User Browser (Web Client)"] -->|OIDC Authentication| IdP["OIDC Identity Provider (Auth0/Keycloak/Clerk)"]
    Client -->|HTTPS + Bearer JWT| WebApp["Next.js App Router (apps/web)"]
    WebApp -->|HTTP / JSON API| GoAPI["Go Core API (services/api)"]
    
    subgraph Core Monolith Backend
        GoAPI -->|JWKS Validation| IdP
        GoAPI -->|Auth Middleware| Router["chi Router / Middleware"]
        Router -->|RBAC & Tenant Scoping| Services["Accounting & Domain Services"]
        Services -->|Atomic SQL Transactions| Postgres[("PostgreSQL Database")]
        Services -->|Async Processing| Worker["Go Background Worker (services/worker)"]
    end
    
    subgraph Intelligence Subsystem
        Services -->|Internal Read-Only API| PyIntel["Python Intelligence (services/intelligence)"]
        PyIntel -->|Suggestions & Anomalies| Services
    end

    classDef client fill:#f9f,stroke:#333,stroke-width:2px;
    classDef core fill:#bbf,stroke:#333,stroke-width:2px;
    classDef db fill:#dfd,stroke:#333,stroke-width:2px;
    classDef intel fill:#ffd,stroke:#333,stroke-width:2px;
    
    class Client client;
    class GoAPI,Router,Services,Worker core;
    class Postgres,IdP db;
    class PyIntel intel;
```

---

## 3. Component Responsibilities

### 3.1 OIDC Identity Provider (IdP)
- Manages user credential storage (passwords), multi-factor authentication (MFA), account recovery, and social/enterprise SSO.
- Issues OIDC ID tokens and JWT access tokens containing standard claims (`iss`, `aud`, `sub`, `email`).

### 3.2 Next.js Web Client (`apps/web`)
- User interface built with React, TypeScript, and Tailwind CSS.
- Initiates OIDC login flow with the IdP and attaches Bearer JWT access tokens to Go API requests.

### 3.3 Go Core API (`services/api`)
- Resource server built with Go `chi` router, `pgx` driver, and `sqlc` database queries.
- Validates OIDC JWT signatures via public JWKS endpoints, verifying issuer (`iss`) and audience (`aud`).
- Maps OIDC subject claims (`sub`) to local application user profiles and tenant organization memberships.
- Owns all business, accounting, validation, and authorization logic.
- Enforces strict tenant isolation (`WHERE organization_id = $1`) and accounting invariants: fixed-precision arithmetic, double-entry balance equality ($\sum \text{Debits} = \sum \text{Credits}$), immutability, period locks, and atomic audit logging within single database transactions.

### 3.4 Go Worker Service (`services/worker`)
- Executes asynchronous background tasks (e.g. batch CSV transaction parsing, financial PDF export rendering) under strict tenant scoping.

### 3.5 Python Intelligence Service (`services/intelligence`)
- Built with FastAPI, pandas, scikit-learn, and statsmodels.
- Provides transaction category recommendations, confidence scores, anomaly detection flags, and cash flow projections.
- Purely advisory: CANNOT mutate database state or post journal entries directly. All AI recommendations require explicit human approval by an authorized user (`Accountant` or higher).

### 3.6 PostgreSQL Database
- Single persistent source of truth for multi-tenant data, user profiles, chart of accounts, staged transactions, immutable posted journal entries, and audit logs.
- Stores user profiles mapped to OIDC external subject identifiers (`external_subject_id`). Passwords are NOT stored in PostgreSQL.

---

## 4. Sequence Diagram: Atomic Journal Entry Posting Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as Accountant / Admin
    participant Web as Web Client (Next.js)
    participant IdP as OIDC IdP
    participant API as Go Core API
    participant DB as PostgreSQL

    User->>Web: Submit Journal Entry Form
    Web->>API: POST /api/v1/journal-entries (Bearer JWT, Idempotency-Key)
    API->>IdP: Validate JWT via JWKS (iss, aud, sig)
    IdP-->>API: Token Valid (sub, email)
    API->>API: 1. Verify User Membership & Role (Accountant+)
    API->>API: 2. Check Idempotency Key
    API->>API: 3. Assert Debits == Credits (Fixed-Decimal)
    API->>DB: 4. Query Fiscal Period Status for Transaction Date
    alt Fiscal Period is CLOSED / LOCKED
        DB-->>API: Status = CLOSED
        API-->>Web: 422 Unprocessable Entity (PERIOD_LOCKED)
        Web-->>User: Display Period Locked Error
    else Fiscal Period is OPEN
        API->>DB: 5. BEGIN DB TRANSACTION (SERIALIZABLE)
        API->>DB: 6. Insert Journal Entry & Line Items (Status = POSTED)
        API->>DB: 7. Insert Audit Log Event (Same Transaction)
        API->>DB: 8. COMMIT TRANSACTION
        DB-->>API: Transaction Committed Successfully
        API-->>Web: 201 Created (Journal Entry JSON)
        Web-->>User: Show Confirmation & Updated Ledger
    end
```

---

## 5. Security & Isolation Architecture
- All API routes are protected by tenant validation middleware:
  $$\text{Bearer JWT} \longrightarrow \text{JWKS Verification} \longrightarrow \text{Map } \texttt{sub} \text{ to User} \longrightarrow \text{Assert Org Membership} \longrightarrow \text{Inject Org Context}$$
- DB Connection Pooling uses `pgxpool` with composite tenant foreign keys `(organization_id, id)` to prevent cross-tenant entity referencing at the schema level.
