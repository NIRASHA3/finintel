# FinIntel

FinIntel is a multi-tenant financial operations application built around a fixed-precision, double-entry ledger. The monorepo contains a Next.js operations console, a Go core API, a PostgreSQL schema, and a Python advisory intelligence service.

## Current product surface

Implemented application areas include organization workspaces, chart of accounts, staged transactions, journal entries and reversals, fiscal periods, financial reports, anomaly review, audit history, and tenant administration. Reconciliation, foreign-exchange revaluation, and webhooks are visible prototypes and are labelled **Demo** in the UI.

Authentication is designed for a provider-neutral OpenID Connect provider. Passwords, MFA, recovery, and SSO belong to the identity provider—not this repository. The current UI branch still uses development authentication and must be integrated with the completed OIDC/BFF security work before a public production launch; see [Deployment](infrastructure/DEPLOYMENT.md) and [E2E tests](tests/e2e/README.md).

## Architecture

```text
apps/web                  Next.js 15 / React 19 operations console
services/api              Go core accounting and tenant API
services/intelligence     FastAPI advisory ML service
services/worker           Planned asynchronous worker (not deployed)
database/migrations       PostgreSQL migrations managed by goose
contracts/openapi         Canonical OpenAPI 3.1 contract
infrastructure            Local containers and deployment runbook
```

Production targets are Vercel for `apps/web`, Neon for PostgreSQL, and Render Docker services for the Go API and Python intelligence service. No AWS or Terraform deployment is required.

## Local development

Prerequisites: Node.js 22, pnpm 10, Go 1.25, Python 3.11, and Docker Desktop for the full stack.

```bash
pnpm install --frozen-lockfile
docker compose up --build
```

Local endpoints: web `http://localhost:3000`, Go API `http://localhost:8080`, intelligence API `http://localhost:8000`, and PostgreSQL `localhost:5432`.

For host-based development, copy `.env.example` to `.env`, use safe local credentials, and run the individual workspace commands.

## Verification

```bash
pnpm --filter web lint
pnpm --filter web type-check
pnpm --filter web test
pnpm --filter web build
pnpm lint:openapi

cd services/api
go vet ./...
go test ./...

cd ../intelligence
python -m pytest
```

Deployment also requires the release gates documented in [tests/e2e/README.md](tests/e2e/README.md), including real OIDC login, tenant isolation, and role authorization.
