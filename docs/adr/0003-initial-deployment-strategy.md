# ADR 0003: Initial Deployment Strategy - Vercel, OIDC IdP & Managed PostgreSQL

* **Status**: Accepted
* **Date**: 2026-08-09
* **Deciders**: Infrastructure & Architecture Team

## Context & Problem Statement
FinIntel requires an initial deployment architecture that supports rapid front-end iteration, global CDN edge delivery for the Next.js client, delegated identity federation via OIDC, managed PostgreSQL database infrastructure, and a portable backend strategy for the Go API.

## Decision Drivers
* Speed of deployment and low operational maintenance for initial launch.
* Native integration with Next.js App Router features (SSR, edge caching).
* Portability requirement: Go API must remain portable to migrate to AWS ECS/Fargate, GCP Cloud Run, or dedicated Kubernetes clusters without rewriting business logic.

## Decision Outcome
Chosen Option: **Deploy Next.js Web App to Vercel, integrate provider-neutral OIDC IdP (e.g. Auth0 / Keycloak / Clerk), utilize Managed PostgreSQL, and maintain Portable Go API Service**.

### Deployment Architecture Details
1. **Web App**: Deployed natively on Vercel platform.
2. **Identity Provider**: External OIDC Identity Provider managing user credential storage, MFA, and OAuth2 token issuance.
3. **Database**: Managed PostgreSQL provider accessed via SSL-encrypted `DATABASE_URL` with transaction pooling enabled.
4. **Go Core API**: Packaged as standard Go binary/container, capable of running as Vercel Go Serverless Functions, AWS Fargate container, or GCP Cloud Run service. Validates tokens via IdP `OIDC_JWKS_URL`.
5. **Python Intelligence**: Containerized FastAPI service hosted on managed container platform (e.g. AWS ECS / GCP Cloud Run).

### Positive Consequences
* Zero infrastructure setup overhead for Next.js frontend hosting or password database management.
* Highly resilient database managed with automated continuous WAL backup and point-in-time recovery.
* High backend portability ensuring no platform lock-in for the core Go domain logic.
