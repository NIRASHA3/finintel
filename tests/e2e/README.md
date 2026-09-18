# End-to-end and deployment test plan

Playwright should run against the same topology used in production: Vercel-compatible Next.js, the Render-compatible Go API and intelligence containers, PostgreSQL, and a real or deterministic test OIDC provider.

## Required infrastructure

- Use `docker compose up --build` for pull-request and local full-stack runs.
- Seed only synthetic tenant/user data.
- Run migrations before tests and reset data between suites.
- Never use the development token path for authentication release tests.
- Run a smaller smoke suite against Vercel Preview + Render + a disposable Neon branch before promotion.

## Release-gate journeys

1. OIDC sign-in, callback, session restoration, refresh, sign-out, expired session, and failed issuer/audience validation.
2. First-user organization onboarding and multi-organization switching.
3. Owner/Administrator member management and fiscal-period controls.
4. Accountant transaction review, account management, journal posting, reversal, and balanced-entry validation.
5. Analyst and Auditor read-only behavior, including direct forbidden API calls—not only hidden UI buttons.
6. Cross-tenant read/write isolation with two users and two organizations.
7. CSV validation, duplicate handling, review, approval, and batch posting.
8. Balance Sheet, Income Statement, and Trial Balance consistency against known ledger fixtures.
9. Advisory anomaly/category results showing confidence, explanation, and model version without automatic posting.
10. Keyboard navigation, focus management, accessible names, responsive layouts, empty/loading/error states, and basic automated accessibility checks.

## Demo-only surfaces

Bank reconciliation, FX revaluation, and webhook pages should be tested only for honest Demo labelling and stable rendering until their backend workflows are production-complete.

## Deployment smoke checks

- `/health/live`, `/health/ready`, and intelligence `/health` return expected status.
- Vercel can reach Render over HTTPS and CORS accepts only configured origins.
- Neon connections require TLS and runtime credentials cannot perform schema-owner operations.
- OIDC redirect and callback URLs exactly match the deployed domains.
- No development bearer tokens, default-Admin behavior, mock financial data, or secrets appear in production responses/assets.

The E2E suite is a required remaining work item; it has not yet been implemented in this directory.
