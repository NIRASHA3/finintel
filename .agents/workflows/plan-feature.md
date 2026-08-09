# Workflow: Plan Feature

## Objective
Establish a clear, verified implementation specification for any new feature before writing application code.

## Steps

1. **Requirement Analysis**:
   - Review product and functional requirements in `docs/requirements/`.
   - Identify affected user roles, API contracts, and database schema changes.

2. **Domain & Invariant Check**:
   - Verify compliance with rules in `.agents/rules/finance-invariants.md`.
   - Ensure tenant isolation (`organization_id`) is defined for all new entities.
   - Verify integer minor units or fixed decimals are specified for monetary data.

3. **API & Data Model Specification**:
   - Define or update the OpenAPI contract in `contracts/openapi/`.
   - Plan SQL migrations in `database/migrations/` and sqlc queries in `database/queries/`.

4. **Implementation Plan Document**:
   - Draft an implementation plan covering backend, frontend, intelligence, and test coverage.
   - Review security and threat mitigations against `docs/threat-model/initial-threat-model.md`.
