# ADR 0003: Vercel, Neon, and Render deployment

* **Status**: Accepted (supersedes the earlier generic/AWS-capable Phase 9 plan)
* **Updated**: 2026-09-16

## Context

FinIntel needs an initial deployment with low operational cost, native Next.js hosting, managed PostgreSQL, and portable container hosting. AWS and Terraform are no longer part of Phase 9.

## Decision

1. Deploy `apps/web` to Vercel.
2. Use an external provider-neutral OIDC identity provider for passwords, MFA, recovery, and SSO.
3. Host PostgreSQL on Neon with TLS, pooled runtime connections, and a separate migration path.
4. Deploy the Go API and Python intelligence service as independent Docker web services on Render.
5. Do not deploy the planned worker until an executable worker service and queue design exist.
6. Use root Docker Compose for local topology parity; local PostgreSQL substitutes for Neon.
7. Configure resources manually through the platform dashboards for the initial release. No Terraform state or AWS resources are required.

## Consequences

- The Go and Python services remain portable OCI containers.
- Cross-origin configuration, OIDC callbacks, service URLs, and secrets span three providers and must be managed explicitly.
- Free tiers may cold-start, throttle, or change quotas; the project makes no uptime guarantee based on them.
- Database migrations remain an explicit release step rather than running automatically in every API instance.
- Preview deployments require deliberate CORS and OIDC callback allow-list management.

Operational steps are documented in `infrastructure/DEPLOYMENT.md`.
