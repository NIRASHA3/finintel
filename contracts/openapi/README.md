# OpenAPI Specification (`contracts/openapi`)

## Overview
This directory contains the canonical OpenAPI 3.1 specification (`openapi.yaml`) representing the REST API contract between the Next.js frontend client (`apps/web`) and the Go core API (`services/api`).

## Status
The specification covers health, organization, account, ledger, staging, reporting, anomaly, audit, fiscal-period, reconciliation, FX, webhook, and member-management endpoints implemented across the project phases. Redocly validation runs in CI. Contract parity tests should remain a deployment gate whenever handlers or frontend client calls change.

## Validation Commands
Run from project root:

```bash
# Validate OpenAPI specification
pnpm lint:openapi
```
