# Core API Service (`services/api`)

## Overview
`services/api` is the core Go backend application powering FinIntel. Built with `chi` router, `pgx` driver, and `sqlc` queries, it serves as the single source of truth for business rules, accounting integrity, and multi-tenant data access.

## Status
* **Milestone 0**: Blueprint directory established. Application code and Go package scaffolding are intentionally deferred to **Milestone 1**.

## Planned Scope & Features
- RESTful HTTP API conforming to OpenAPI 3.0 specification (`contracts/openapi`).
- Backend-enforced authorization and multi-tenant scoping (`organization_id`).
- Double-entry ledger engine enforcing integer/fixed-decimal precision, entry balance checks, immutability, and fiscal period locks.
- Immutable audit log recorder.
