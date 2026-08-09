# Workflow: Verify Feature

## Objective
Thoroughly validate that a implemented vertical slice satisfies all domain rules, security standards, and functional requirements.

## Steps

1. **Automated Test Execution**:
   - Run Go unit and integration tests: `go test ./...` in `services/api`.
   - Run Vitest frontend tests: `pnpm test` in `apps/web`.
   - Run Pytest analytics tests: `pytest` in `services/intelligence`.
   - Run Playwright E2E suite: `pnpm exec playwright test` in `tests/e2e`.

2. **Tenant Isolation Verification**:
   - Verify that all database queries contain explicit `organization_id` checks.
   - Run multi-tenant security unit test verifying cross-tenant access returns 403/404.

3. **Financial Invariant Check**:
   - Verify double-entry balance check enforces `Debits == Credits`.
   - Verify fixed-precision math (no floats).
   - Verify posting to closed fiscal period is rejected.

4. **Secret & Log Audit**:
   - Scan modified code for hardcoded secrets or API keys.
   - Verify no sensitive financial payloads or tokens are output to logs.
