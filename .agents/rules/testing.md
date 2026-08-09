# Testing Strategy & Guidelines

## 1. Testing Pyramid & Responsibilities
- **Unit Tests**: Test isolated business domain functions, accounting calculations, and utility helpers. Fast execution (< 100ms).
- **Integration Tests**: Test database queries, HTTP router endpoints, and service integrations against real/containerized dependencies.
- **End-to-End (E2E) Tests**: Validate critical user flows (login, tenant switching, CSV import, journal posting, report rendering).

## 2. Test Execution Technologies
- **Go Services (`services/api`, `services/worker`)**: Native `go test` with `testify` assertions. Database integration tests using temporary Postgres containers or test databases.
- **Web Frontend (`apps/web`)**: Vitest and React Testing Library for component unit tests. Playwright for end-to-end browser testing (`tests/e2e`).
- **Python Intelligence (`services/intelligence`)**: `pytest` for endpoint schemas, model predictions, and dataframe transformation functions.

## 3. Financial Test Invariants
- Unit tests MUST explicitly test boundary conditions for double-entry journal postings (unbalanced debit/credit payloads must fail).
- Unit tests MUST verify that closed accounting period postings throw explicit domain error codes.
- Test suites MUST verify fixed-precision decimal arithmetic against rounding edge cases.

## 4. Multi-Tenant Test Isolation
- Integration test suites MUST create separate test organizations for isolated test runs.
- Cross-tenant data leak tests MUST be included in the API test suite (verify Tenant A cannot access Tenant B resources under any circumstance).
