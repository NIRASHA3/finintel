# FinIntel — Autonomous Multi-Tenant Financial Intelligence Platform

FinIntel is an AI-assisted financial ledger, multi-source ingestion engine, and automated accounting platform for modern enterprises.

## Monorepo Workspace Architecture

```text
finintel/
├── .github/
│   └── workflows/
│       └── ci.yml                          # GitHub Actions CI workflow
├── apps/
│   └── web/                                # Next.js 15 App Router web client shell
├── contracts/
│   └── openapi/                            # Canonical OpenAPI 3.1 contract specification
├── database/
│   └── migrations/                         # PostgreSQL DDL schema migrations (goose)
└── services/
    ├── api/                                # Go Core API (chi/v5, pgx/v5, slog)
    ├── intelligence/                       # Python intelligence service (Milestone 7 blueprint)
    └── worker/                             # Go background worker service (Milestone 4 blueprint)
```

## Milestone 1: Engineering Foundation

Milestone 1 establishes the baseline engineering foundation required for vertical slice implementation:
* **Next.js Web Shell (`apps/web`)**: Next.js 15 App Router, React 19, strict TypeScript, Tailwind CSS, design tokens, and RTL/Vitest component testing.
* **Go Core API (`services/api`)**: Go 1.22+ portable modular monolith (`github.com/NIRASHA3/finintel/services/api`), `chi/v5` router, `pgx/v5` connection pool, environment configuration validation, structured `slog` logging, graceful shutdown, and `/health/live` & `/health/ready` handlers.
* **OpenAPI 3.1 Specification (`contracts/openapi`)**: Canonical contract defining HTTP request/response schemas validated with Redocly CLI.
* **PostgreSQL Migration Tooling (`database/migrations`)**: Selected `pressly/goose` (v3.24.1) raw SQL CLI migration manager.
* **GitHub Actions CI (`.github/workflows/ci.yml`)**: Automated pipeline verifying Web lint, type-check, tests, and build; Go format, vet, and unit tests; and OpenAPI contract validation.

## Local Development Setup

### Prerequisites
* **Node.js**: `v22.12.0` or higher
* **pnpm**: `v10.34.5` or higher
* **Go**: `1.22` or higher
* **PostgreSQL**: `15+` (Optional for Milestone 1; `/health/live` operates without a running DB)

### Installation & Verification Commands

```powershell
# 1. Install workspace dependencies
pnpm install --frozen-lockfile

# 2. Run Web linting, type-checking, and tests
pnpm --filter web lint
pnpm --filter web type-check
pnpm --filter web test
pnpm --filter web build

# 3. Run Go formatting check, static analysis, and unit tests
gofmt -s -l services/api/
cd services/api; go vet ./...; go test -v ./...

# 4. Run OpenAPI contract validation
pnpm lint:openapi
```

### Migration Tooling Installation (`goose`)

```powershell
# Install pinned goose development CLI
go install github.com/pressly/goose/v3/cmd/goose@v3.24.1
```
