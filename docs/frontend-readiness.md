# Frontend product and release readiness audit

Updated: 2026-09-16

## Page relevance

| Page | Product fit | Current state | Release note |
|---|---|---|---|
| Dashboard | Core financial overview | Implemented UI/API integration | Validate every metric against ledger fixtures. |
| Transactions | Import and human review | Implemented with sample-data helper | Keep sample generation development-only in production. |
| General Ledger | Double-entry posting and reversals | Implemented | RBAC and locked-period errors require E2E coverage. |
| Chart of Accounts | Account configuration | Implemented | Restrict mutations to Owner, Administrator, and Accountant. |
| Financial Reports | Balance Sheet, P&L, Trial Balance | Implemented | Reports are ledger-derived; no blanket GAAP certification is claimed. |
| Fiscal Periods | Period close controls | Implemented | Owner/Administrator authorization must be verified server-side. |
| Anomalies | Advisory review queue | Implemented | Always display confidence, explanation, and model version. |
| Audit Trail | Recorded activity history | Implemented | Described as append-only; no unsupported cryptographic-verification claim. |
| Tenant Details | Workspace and members | Partially implemented | Member management is visibly labelled Demo where incomplete. |
| Reconciliation | Bank matching | Prototype | Keep Demo label until persistent imports and matching are complete. |
| FX Revaluation | Multi-currency workflow | Prototype | Keep Demo label until rate sources and posting workflow are complete. |
| Webhooks | Outbound integrations | Prototype | Keep Demo label until delivery persistence/retry/signing are complete. |

## Header, navigation, and footer

The active application shell is `app/components/ui/AppShell.tsx`; obsolete standalone header/footer components were removed. Navigation groups match the accounting workflow and prototype pages carry Demo badges. The footer links to real tenant and audit pages and describes the implemented fixed-precision double-entry design without claiming GAAP certification.

## Authentication decision

A sign-in experience is required, but FinIntel must not build a password form or store credentials. Add a branded `/login` page whose primary action starts the provider-neutral OIDC Authorization Code + PKCE flow. The identity provider owns credential entry, MFA, password reset, and account recovery.

Before adding the page to this branch, integrate the completed OIDC/BFF security track so `/api/auth/login`, callback, refresh, session, logout, and API proxy routes exist. Then:

1. Redirect unauthenticated application routes to `/login?returnTo=...`.
2. Keep `/login` and the callback routes outside the authenticated application shell.
3. Replace all hard-coded development bearer tokens.
4. Add a real user menu and sign-out action.
5. Render navigation and mutation controls from the server-resolved membership role.
6. Continue enforcing every permission in the Go API and PostgreSQL; client-side hiding is not security.

## Remaining release blockers

- Merge the OIDC/BFF and tenant-security track into the UI branch and resolve conflicts deliberately.
- Remove development-token fallback and default-Admin behavior from production paths.
- Implement Playwright release gates described in `tests/e2e/README.md`.
- Complete or continue labelling the three prototype features.
- Authenticate the Go-to-intelligence service boundary.
- Validate migrations and least-privilege roles on a disposable Neon branch.
- Add production monitoring, backups, secret rotation, and incident procedures.
