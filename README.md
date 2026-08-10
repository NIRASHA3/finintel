# FinIntel - Multi-Tenant Financial Operations SaaS

## Product Overview

FinIntel is a production-oriented, multi-tenant financial operations SaaS application designed for modern organizations. It streamlines core financial workflows by combining strict double-entry accounting invariants with AI-assisted transaction categorization, anomaly detection, and explainable forecasting.

### Core Capabilities
- **Multi-Tenant Operations**: Strict data segregation per organization using composite tenant-safe keys (`organization_id`).
- **OIDC Identity Federation**: Provider-neutral OpenID Connect (OIDC) authentication delegating passwords, MFA, and recovery to external IdPs.
- **Financial Transaction Management**: CSV import, duplicate detection, staged transaction pipeline, and human-in-the-loop review.
- **Double-Entry General Ledger**: Chart of accounts, immutable posted journal entries, balanced debit/credit posting, and fiscal period locking.
- **Financial Intelligence**: Advisory AI-driven anomaly detection and forecasting with mandatory human approval.
- **Atomic Audit & Compliance**: Atomic audit trails for every mutation recorded in the same database transaction with correlation ID tracking.

---

## Current Project Status

* **Current Phase**: **Milestone 0 - Project Foundation**
* **Git Branch**: `feature/project-foundation`
* **Status**: Architectural definitions, engineering invariants, provider-neutral OIDC alignment, security baseline, and repository structure established. Application code, dependencies, and deployments are intentionally deferred until subsequent milestones.

---

## Planned Architecture

FinIntel is designed as a **Modular Monolith** to maximize engineering velocity while preserving strict domain boundaries.

```
                  ┌──────────────────────────────────────────────┐
                  │    User Browser (Next.js App Router Client)   │
                  └───────┬──────────────────────────────┬───────┘
                          │ OIDC Login                   │ HTTPS / REST API
                          ▼                              ▼
             ┌─────────────────────────┐   ┌───────────────────────────┐
             │ OIDC Identity Provider  │   │     Go Core API           │
             │ (Auth0 / Keycloak / etc)│   │ (Single Source of Truth)  │
             └─────────────────────────┘   └─────────────┬─────────────┘
                                                         │
                                        Atomic SQL (pgx) │ Internal HTTP
                                                         ▼
                                       ┌────────────────────────────────┐
                                       │ PostgreSQL Database            │
                                       │ (Shared-Schema Multi-Tenant)   │
                                       └────────────────────────────────┘
```

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
│   ├── adr/              # Architecture Decision Records (ADRs 0001 - 0004)
│   ├── threat-model/     # STRIDE threat model & mitigations
│   └── design-reference/ # UI design tokens, screen inventory, and screenshots
├── infrastructure/
│   ├── docker/           # Docker setup (deferred)
│   └── terraform/        # Infrastructure as Code (deferred)
├── tests/
│   └── e2e/              # Playwright end-to-end tests
├── .env.example          # Environment variable template
├── .gitignore            # Git exclusion rules
├── .gitattributes        # Git line ending normalization
├── .editorconfig         # Code formatting configuration
└── README.md             # Project documentation index
```

---

## Implementation Roadmap

| Milestone | Scope | Description | Status |
|---|---|---|---|
| **Milestone 0** | Project Foundation | Monorepo layout, agent rules, NFRs, domain invariants, ADRs, OIDC alignment | **Complete** |
| **Milestone 1** | Engineering Foundation | Monorepo toolchain, code linting, Go/TS/Python base setups, contract definitions | Planned |
| **Milestone 2** | Identity and Tenancy | OIDC JWT validation, organization provisioning, RBAC, tenant context middleware | Planned |
| **Milestone 3** | Onboarding | Organization wizard, COA template initialization, member invitation flow | Planned |
| **Milestone 4** | CSV Transaction Import and Review | File parser, staged transaction pipeline, duplicate detection, review queue | Planned |
| **Milestone 5** | Accounting | Double-entry posting engine, fiscal period locks, entry immutability, atomic audit logs | Planned |
| **Milestone 6** | Reports and Dashboard | Income Statement, Balance Sheet, Trial Balance, executive dashboard | Planned |
| **Milestone 7** | Intelligence | Python FastAPI advisory service, anomaly detection, cash flow forecasting, evaluation | Planned |
| **Milestone 8** | Production Hardening and Deployment | End-to-end Playwright tests, security hardening, production staging deployment | Planned |

---

## Local Development Status

Local runtime execution, package installations, and scaffolding are deferred until **Milestone 1**.

---

## Security & Accounting Principles

### Accounting Invariants
- **No Floating-Point Money**: All financial monetary values must use fixed-precision decimal values (`NUMERIC(20,4)`) or integer minor units (e.g., cents).
- **Balanced Postings**: Posted journal entries must satisfy $\sum \text{Debits} = \sum \text{Credits}$.
- **Immutability & Reversals**: Posted journal entries cannot be edited or deleted. Adjustments require explicit reversal entries.
- **Period Locking**: Posted transactions in closed fiscal periods are strictly rejected.
- **Atomic Audit Trail**: Ledger mutations and audit log records execute atomically in the same database transaction.

### Security Invariants
- **Provider-Neutral OIDC**: Identity, password storage, MFA, and account recovery are delegated to an external IdP. PostgreSQL stores application user profiles mapped via `external_subject_id`.
- **Tenant Isolation**: Every database query filters by `organization_id`. Tenant-scoped entities enforce composite foreign keys `(organization_id, id)`.
- **Human-in-the-Loop AI**: AI suggestions are strictly advisory and CANNOT post journal entries automatically.

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
- `docs(adr): record decision on provider-neutral OIDC authentication`
- `test(api): add unit tests for fiscal period lock enforcement`
