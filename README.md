# FinIntel - Multi-Tenant Financial Operations SaaS

## Product Overview

FinIntel is a production-oriented, multi-tenant financial operations SaaS application designed for modern organizations. It streamlines core financial workflows by combining strict double-entry accounting invariants with AI-assisted transaction categorization, anomaly detection, and explainable forecasting.

### Core Capabilities
- **Multi-Tenant Operations**: Strict data segregation per organization (`organization_id`).
- **Financial Transaction Management**: CSV import, duplicate detection, and automated categorization review.
- **Double-Entry General Ledger**: Chart of accounts, immutable posted journal entries, balanced debit/credit posting, and fiscal period locking.
- **Financial Intelligence**: AI-driven anomaly detection and forecasting with human-in-the-loop explainability.
- **Audit & Compliance**: Complete audit trails for every mutation recording organization, actor, timestamp, and correlation ID.

---

## Current Project Status

* **Current Phase**: **Milestone 0 - Project Foundation**
* **Git Branch**: `feature/project-foundation`
* **Status**: Architectural definitions, engineering invariants, security baseline, and repository structure established. Application code and deployments are intentionally deferred until Milestone 1.

---

## Planned Architecture

FinIntel is designed as a **Modular Monolith** to maximize engineering velocity while preserving strict domain boundaries.

```
                     ┌───────────────────────────────────┐
                     │          Web App (Next.js)         │
                     └─────────────────┬─────────────────┘
                                       │ HTTPS / REST API
                                       ▼
                     ┌───────────────────────────────────┐
                     │        Go API (chi / pgx)         │
                     │  (Single Source of Truth & Auth)  │
                     └───────┬───────────────────┬───────┘
                             │                   │
            SQL Queries (pgx)│                   │ Internal HTTP
                             ▼                   ▼
           ┌───────────────────┐       ┌───────────────────┐
           │    PostgreSQL     │       │Python Intelligence│
           │  (Primary Data)   │       │(Advisory / AI)    │
           └───────────────────┘       └───────────────────┘
```

### Architectural Principles
1. **PostgreSQL as Single Source of Truth**: Persistent store for all tenants, domain models, ledger entries, and audit logs.
2. **Go API Engine**: Owns all business, accounting, validation, and authorization rules.
3. **Advisory Python Service**: Produces ML predictions, anomaly detection scores, and forecasts. The Python service **cannot** post financial entries directly.
4. **Strict Isolation**: Tenant scoping enforced on every query and endpoint.

---

## Repository Structure

```
finintel/
├── .agents/              # AI Agent rules & workflow guidance
│   ├── rules/            # Architectural, coding, security, and domain rules
│   └── workflows/        # Plan, implement, and verify feature workflows
├── apps/
│   └── web/              # Next.js App Router front-end client
├── services/
│   ├── api/              # Go core REST API service
│   ├── worker/           # Go background processing service
│   └── intelligence/     # Python analytics & forecasting service
├── contracts/
│   └── openapi/          # OpenAPI specifications and generated clients
├── database/
│   ├── migrations/       # SQL schema migration scripts
│   ├── queries/          # sqlc query definitions
│   └── seeds/            # Initial/test data seed scripts
├── docs/                 # Product requirements, architecture, ADRs, threat model
│   ├── requirements/     # Product, functional, and NFR specifications
│   ├── architecture/     # System architecture & data model
│   ├── adr/              # Architecture Decision Records
│   ├── threat-model/     # STRIDE threat model & mitigations
│   └── design-reference/ # UI design tokens and screen references
├── infrastructure/
│   ├── docker/           # Docker setup (deferred)
│   └── terraform/        # Infrastructure as Code (deferred)
├── tests/
│   └── e2e/              # Playwright end-to-end tests
├── .env.example          # Environment variable template
├── .gitignore            # Git exclusion rules
└── README.md             # Project documentation index
```

---

## Implementation Roadmap

| Milestone | Phase | Description | Status |
|---|---|---|---|
| **Milestone 0** | Project Foundation | Monorepo layout, agent rules, NFRs, domain invariants, ADRs | **Complete** |
| **Milestone 1** | Core Domain & Auth | Go API foundation, DB schema, tenant isolation, Auth & Users | Planned |
| **Milestone 2** | General Ledger | Chart of accounts, double-entry postings, period locking, reversals | Planned |
| **Milestone 3** | Import & Categorization | CSV import parser, duplicate detection, transaction review | Planned |
| **Milestone 4** | Intelligence & Anomaly | Python FastAPI analytics service, anomaly scoring, explainable forecasts | Planned |
| **Milestone 5** | Web Application | Next.js App Router UI, dashboard, ledger management, reports | Planned |
| **Milestone 6** | E2E Testing & Hardening | Playwright tests, performance tuning, threat mitigations | Planned |

---

## Local Development Status

Local runtime execution and scaffolding are deferred until **Milestone 1**.

### Prerequisites (For Milestone 1+)
* **Node.js**: v22.x+
* **pnpm**: v9.x+
* **Go**: v1.22+
* **Python**: v3.11+
* **PostgreSQL**: v16+

---

## Security & Accounting Principles

### Accounting Invariants
- **No Floating-Point Money**: All financial monetary values must use fixed-precision decimal values (`NUMERIC(20,4)`) or integer minor units (e.g., cents).
- **Balanced Entries**: Posted journal entries must satisfy `SUM(Debits) == SUM(Credits)`.
- **Immutability**: Posted journal entries cannot be edited or deleted. Adjustments require explicit reversal entries.
- **Period Locking**: Posted transactions in closed fiscal periods are strictly rejected.

### Security Invariants
- **Backend Authorization**: The API backend must verify organization membership and permissions on every request.
- **Tenant Isolation**: Every database query must filter by `organization_id`.
- **Zero Credentials in Code**: No API keys, database passwords, or JWT secrets in source code.
- **Data Protection**: Never log sensitive financial payload contents, tokens, or credentials.

---

## Contribution Workflow & Commit Standards

### Branching & PR Strategy
1. Create a feature branch off `main`: `feature/<short-description>`.
2. Ensure changes pass all agent rules and workflow verifications.
3. Open a Pull Request with a clear description of domain impact and verification results.

### Commit Message Format
We enforce Conventional Commits:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

#### Professional Commit Examples
- `feat(ledger): implement double-entry journal posting verification`
- `fix(auth): enforce organization membership validation on transaction review`
- `docs(adr): record decision on modular monolith architecture`
- `test(api): add unit tests for fiscal period lock enforcement`
