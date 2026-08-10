# Architecture Engineering Rules

## 1. System Boundaries & Monolith Strategy
- **Modular Monolith**: FinIntel is structured as a single monorepo housing clear component domains. Do not create microservices without an approved Architectural Decision Record (ADR).
- **Go API as Core Authority**: The Go API (`services/api`) is the sole authoritative gateway for business rules, accounting invariants, OIDC token validation, data persistence, and authorization.
- **Provider-Neutral OIDC**: User authentication, password storage, MFA, and account recovery are delegated to an external OIDC Identity Provider. PostgreSQL stores user profiles mapped via `external_subject_id`. Passwords MUST NOT be stored in PostgreSQL.
- **Python Intelligence Boundary**: The Python service (`services/intelligence`) is purely advisory. It receives read-only analytics inputs or features and returns predictions, confidence scores, and explanations. It MUST NOT directly read or write to the primary PostgreSQL database or post ledger entries. AI recommendations strictly require human approval before posting.
- **Web Client Boundary**: The Next.js frontend (`apps/web`) is a user interface client. It MUST NOT execute domain calculations, bypass the Go API, or directly query the database.

## 2. Component Layout & Directory Conventions
- `apps/web`: Next.js App Router UI client.
- `services/api`: Go HTTP backend engine (chi router, pgx driver, sqlc queries).
- `services/worker`: Go background processor for async jobs (imports, report generation).
- `services/intelligence`: Python FastAPI analytics service (pandas, scikit-learn, statsmodels).
- `contracts/openapi`: OpenAPI 3.0 specification representing the canonical contract between Web and API.

## 3. Data Ownership & Storage
- PostgreSQL is the single source of truth.
- Every business domain entity table MUST include an `organization_id` column for multi-tenant isolation.
- Tenant-scoped tables MUST enforce composite foreign key definitions `(organization_id, referenced_entity_id)` to prevent cross-tenant data referencing at the schema level.
- All cross-domain communication between Go services and Python services MUST occur over explicit internal HTTP APIs using structured JSON payloads.

## 4. API & Interface Invariants
- RESTful APIs must strictly adhere to the OpenAPI specification defined in `contracts/openapi/`.
- All response payloads must use standardized JSON structures with predictable error objects including error code, message, and correlation ID.
- Changes to API contracts must be backward-compatible or versioned under `/api/v1/`.
