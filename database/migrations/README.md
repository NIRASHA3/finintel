# PostgreSQL Database Migrations (`database/migrations`)

## Overview
This directory stores pure SQL schema migration files for FinIntel's multi-tenant PostgreSQL database.

## Migration Tooling Selection & Justification

### Selected Tool: `pressly/goose` (v3)
* **Justification**:
  1. **Zero ORM Abstraction**: Executes raw `.sql` files directly, keeping PostgreSQL as the authoritative source of truth.
  2. **Row-Level Security (RLS) Support**: Fully supports raw PostgreSQL DDL statements such as `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and `CREATE POLICY ...`.
  3. **Multi-Platform CLI & Go Integration**: Operates as a standalone CLI tool for developers and CI/CD pipelines without polluting runtime application dependencies.
  4. **Strict Atomic Migration Execution**: Wraps schema migrations in explicit database transactions.

## Reproducible Goose Installation & Execution

> [!NOTE]
> `goose` is a development CLI tool installed via the Go toolchain. It is NOT an application runtime code dependency.

### Pinned Goose Installation Command (Windows PowerShell & Bash Compatible)

```powershell
# Install pinned version of goose CLI
go install github.com/pressly/goose/v3/cmd/goose@v3.24.1
```

### Documented Goose Usage Commands

```bash
# Create a new raw SQL migration file
goose -dir database/migrations create add_feature_name sql

# Run all pending migrations
goose -dir database/migrations postgres "$DATABASE_URL" up

# Check current migration status
goose -dir database/migrations postgres "$DATABASE_URL" status

# Rollback last migration
goose -dir database/migrations postgres "$DATABASE_URL" down
```

## Current scope

The migrations create the implemented multi-tenant accounting schema and subsequent audit-log adjustment. Apply them in numeric order to local PostgreSQL or Neon. Production migrations should use a dedicated migration/owner credential; the API runtime credential must remain least-privileged.

Before using Neon, test every migration against a disposable Neon branch and use `sslmode=require`.
