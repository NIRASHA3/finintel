# ADR 0004: Provider-Neutral OpenID Connect (OIDC) Authentication

* **Status**: Accepted
* **Date**: 2026-08-09
* **Deciders**: Architecture & Security Team

## Context & Problem Statement
FinIntel is a multi-tenant SaaS application that requires robust, enterprise-grade authentication, multi-factor authentication (MFA), secure password storage, and account recovery. We must decide whether to build a custom password/JWT authentication engine in the Go API or integrate a provider-neutral OpenID Connect (OIDC) Identity Provider (IdP).

## Decision Drivers
* Security best practices: Avoid storing user passwords or secret hashes in application databases.
* Compliance & Standards: Delegating credential management, MFA, and OAuth2/OIDC flows to dedicated identity providers (e.g. Auth0, Keycloak, Clerk, Okta).
* Flexibility: The application must remain provider-neutral, avoiding tight coupling to any single proprietary authentication vendor.

## Decision Outcome
Chosen Option: **Adopt Provider-Neutral OIDC Authentication**.

### System Responsibilities
1. **Identity Provider (IdP)**:
   - Manages user credential storage (passwords), multi-factor authentication (MFA), password reset/recovery flows, and social/enterprise SSO federation.
   - Issues cryptographically signed OIDC ID tokens and JWT access tokens containing standard claims (`iss`, `aud`, `sub`, `email`).

2. **Go Core API (`services/api`)**:
   - Acts as a Resource Server.
   - Validates incoming Bearer JWT tokens against the IdP's `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, and JSON Web Key Set (`OIDC_JWKS_URL`).
   - Extracts the immutable issuer (`iss`) and external subject identifier (`sub` claim) to resolve local tenant organization membership and user profiles.

3. **PostgreSQL Database**:
   - Stores application user profiles, organization memberships, and role assignments.
   - Maps users via composite identity uniqueness: `UNIQUE (identity_provider_issuer, external_subject_id)`.
   - **MUST NOT** store user passwords, password hashes, or recovery tokens.

### Positive Consequences
* Zero application liability for password database breaches or hashing maintenance.
* Standardized OIDC token validation via public JWKS endpoints.
* Provider neutrality allows swapping Keycloak (self-hosted) for Auth0/Clerk/Okta without changing backend application code.

### Negative Consequences
* Dependency on external IdP availability for authentication token issuance.
* Local integration testing requires a mock OIDC server or Keycloak test container.
