# FinIntel Web Application

`apps/web` is the Next.js 15 App Router operations console for FinIntel. It uses React 19, strict TypeScript, Tailwind CSS, and Vitest.

## Screens

- Dashboard and organization switching
- Transaction staging and review
- General ledger and journal entries
- Chart of accounts
- Financial statements and fiscal periods
- Anomaly review and audit trail
- Tenant details and member management
- Labelled demos: bank reconciliation, FX revaluation, and webhooks

The application shell uses one responsive top bar, sidebar/mobile navigation, and footer. UI copy must describe implemented behavior and must not claim certifications or guarantees that the backend does not provide.

## Authentication and RBAC

Production authentication is provider-neutral OIDC. FinIntel should provide a branded sign-in entry page that redirects to the configured identity provider; it must not implement password storage, password reset, or MFA itself. Backend authorization remains authoritative.

The present UI branch still sends a development bearer token from `lib/api-client.ts`. Before deployment, integrate the OIDC/BFF implementation from the security track, remove hard-coded tokens, add authenticated/unauthenticated route handling, expose sign-out, and render navigation/actions from the server-resolved organization role. Hiding a button is usability only and never replaces API-side RBAC.

## Commands

```bash
pnpm --filter web dev
pnpm --filter web lint
pnpm --filter web type-check
pnpm --filter web test
pnpm --filter web build
```

`NEXT_PUBLIC_API_URL` is embedded at build time. Set it to the public Render API URL in Vercel and Docker production builds. Local Compose uses `http://localhost:8080` because browser requests originate outside the Compose network.

## Accessibility

The shared UI primitives provide landmarks, keyboard focus states, dialog semantics, loading/error states, and responsive navigation. WCAG 2.2 AA is a release target; confirm it with automated checks and manual keyboard/screen-reader testing rather than treating it as a certification.
