# ADR 0002: Establish Go Core API as Single Source of Truth for Business Logic

* **Status**: Accepted
* **Date**: 2026-08-09
* **Deciders**: Software Architecture Team

## Context & Problem Statement
FinIntel incorporates multiple runtime technologies: TypeScript for the Next.js frontend, Go for the core API and background processing, Python for machine learning analytics, and an external OIDC Identity Provider. We must define which component holds single authority over financial rules, journal entry postings, token validation, authorization, and database persistence.

## Decision Drivers
* Financial applications require deterministic, high-performance, and strictly verified domain logic execution.
* Need to prevent duplicate validation rules across frontend and backend.
* Requirement that machine learning/AI models cannot directly alter financial records without explicit human review and backend accounting validation.

## Decision Outcome
Chosen Option: **Establish Go API (`services/api`) as the Single Source of Truth**.

### Rules & Responsibilities
1. **Go API Authority**: All double-entry checks ($\sum \text{Debits} = \sum \text{Credits}$), fiscal period locking, OIDC token signature validation (via JWKS), tenant membership verification, role authorization, fixed-precision arithmetic, atomic audit log creation, and database persistence MUST be executed exclusively by the Go API.
2. **Python Advisory Role**: The Python Intelligence service (`services/intelligence`) is restricted to read-only features. It produces advisory scores, predictions, and forecasts. It CANNOT execute SQL writes or post journal entries directly. All AI recommendations require explicit human approval by an authorized user (`Accountant` or higher).
3. **Web Frontend Presentation Role**: The Next.js client (`apps/web`) handles UI presentation and user interactions. It must rely on Go API response contracts for all accounting state.

### Positive Consequences
* Zero risk of AI service corrupting general ledger tables.
* Single location for financial invariant testing, security enforcement, and OIDC JWKS token validation.
* High concurrency performance and low memory overhead provided by Go runtime.
