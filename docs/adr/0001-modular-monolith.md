# ADR 0001: Adopt Modular Monolith Architecture

* **Status**: Accepted
* **Date**: 2026-08-09
* **Deciders**: Software Architecture Team

## Context & Problem Statement
FinIntel is a multi-tenant financial operations SaaS application requiring strong transactional integrity, double-entry ledger enforcement, and auditability. We must select an architectural pattern that maximizes development velocity, simplifies transaction management across financial domains, and avoids premature microservice operational overhead.

## Decision Drivers
* Need for strict ACID transactional integrity across ledger entries and audit trails.
* Velocity of early-stage product engineering and domain iteration.
* Team operational complexity (managing single deployment vs. multiple independent microservices).
* Need for explicit component boundaries for future modular extraction if necessary.

## Considered Options
1. **Microservices Architecture**: Separate services for Auth, Ledger, Reporting, Anomaly Detection, and Notifications.
2. **Modular Monolith Architecture**: Single monorepo housing well-defined packages/modules with distinct boundaries (`apps/web`, `services/api`, `services/worker`, `services/intelligence`).
3. **Single Unstructured Monolith**: Traditional monolithic codebase without domain separation.

## Decision Outcome
Chosen Option: **Option 2 (Modular Monolith Architecture)**.

### Positive Consequences
* Allows executing multi-table financial postings inside single PostgreSQL database transactions (`BEGIN...COMMIT`), guaranteeing ACID compliance without distributed transactions (Saga pattern).
* Dramatically simplifies local development, testing, and deployment pipeline complexity.
* Preserves clear code boundary separation so individual subcomponents can be extracted into microservices if scaling requirements demand it later.

### Negative Consequences
* Shared database hardware requires careful query tuning and connection pool management under heavy loads.
* Module dependencies must be governed by strict package import rules to prevent tight coupling.
