# Non-Functional Requirements (NFR) Specification

> [!NOTE]
> **INITIAL TARGETS NOTICE**: Performance SLA, availability uptime, latency targets, and recovery time metrics in this document represent unverified initial engineering targets. They will be validated and calibrated through benchmark testing during production hardening (Milestone 8).

---

## 1. Tenant Isolation & Data Security
- **NFR-1.1 Strict Logical Isolation**: Every database query must filter by `organization_id`. Tenant-scoped tables enforce composite foreign key constraints `(organization_id, referenced_entity_id)` to prevent cross-tenant referencing at the schema layer.
- **NFR-1.2 Encryption Standards**: Data in transit must use TLS 1.2 or later. Data at rest must be encrypted using AES-256.
- **NFR-1.3 Zero Trust Architecture**: API controllers must validate JWT signatures via OIDC JWKS, verify organization membership, and assert exact role permissions on every request.

## 2. Data Integrity & Financial Precision
- **NFR-2.1 Exact Arithmetic**: Monetary values MUST be stored as integer minor units or fixed-precision `NUMERIC(20,4)`. IEEE 754 floating-point arithmetic is prohibited for currency.
- **NFR-2.2 ACID Guarantees**: All financial journal postings, period closing operations, and corresponding audit log insertions MUST run atomically within the same PostgreSQL transaction (`SERIALIZABLE` or `REPEATABLE READ`).
- **NFR-2.3 Idempotency**: Financial posting API endpoints and webhooks MUST guarantee idempotency via `Idempotency-Key` headers.

## 3. Accessibility (a11y)
- **NFR-3.1 WCAG Compliance**: Next.js frontend components must comply with **WCAG 2.2 Level AA** standards.
- **NFR-3.2 Screen Reader & Keyboard Support**: Complete keyboard navigation support and ARIA attributes for dynamic modal dialogs, tables, and financial forms.

## 4. Performance & Response Targets (Unverified Initial Targets)
- **NFR-4.1 API Latency Target**: Initial engineering target: 95% of standard read requests (`GET /api/v1/...`) respond in < 150ms.
- **NFR-4.2 Financial Posting Latency Target**: Initial engineering target: 99% of single journal entry postings execute in < 250ms.
- **NFR-4.3 Batch CSV Import Target**: Initial engineering target: Support importing 10,000 transactions in < 10 seconds via async background worker processing.

## 5. Availability & Uptime (Unverified Initial Targets)
- **NFR-5.1 Service Availability Target**: Initial engineering target: 99.9% uptime (excluding scheduled maintenance windows).
- **NFR-5.2 Graceful Degradation**: If the Python Intelligence service is unreachable, the Go API must remain 100% operational for manual entry, review, and reporting.

## 6. Scalability & Workload Management
- **NFR-6.1 Stateless Backend**: Go API and Python Intelligence services must be completely stateless to allow horizontal scaling behind a load balancer.
- **NFR-6.2 Database Connection Pooling**: Go API must use `pgxpool` with strict connection limits (`DATABASE_MAX_CONNS`).

## 7. Observability & Telemetry
- **NFR-7.1 Structured Logging**: All application logs must be output as JSON to `stdout` containing `timestamp`, `level`, `service`, `organization_id`, `correlation_id`, and `message`.
- **NFR-7.2 Metrics & Distributed Tracing**: Expose Prometheus metrics (`/metrics`) and propagate OpenTelemetry trace contexts (`W3C Trace Context`) across Web, API, and Intelligence services.

## 8. Backup, Recovery & Disaster Recovery (Unverified Initial Targets)
- **NFR-8.1 Point-in-Time Recovery (PITR)**: Managed PostgreSQL must maintain continuous WAL archiving enabling PITR restore to any point within the past 30 days.
- **NFR-8.2 Recovery Objectives Target**: Initial engineering target: Recovery Point Objective (RPO) < 5 minutes; Recovery Time Objective (RTO) < 2 hours.

## 9. Privacy & Compliance
- **NFR-9.1 Log Sanitization**: Automatically strip authorization tokens, PII, and financial payloads from log aggregators.
- **NFR-9.2 Jurisdiction-Configurable Audit Retention**: Immutable audit logs retention policy is jurisdiction-configurable based on regional statutory accounting compliance requirements.

## 10. Maintainability & Code Quality
- **NFR-10.1 Test Coverage**: Minimum 80% code coverage target on Go API business/accounting packages and Python data transformation utilities.
- **NFR-10.2 Type Safety**: Enforce strict TypeScript (`strict: true`) on Web frontend, static type safety in Go, and type hints in Python.

## 11. AI Quality & Evaluation Methodology
- **NFR-11.1 Empirical Evaluation Methodology**: Automated ML categorization suggestion engine quality must be evaluated using a documented benchmark methodology (evaluating precision, recall, and F1-score across standard test corpora). Production acceptance thresholds will be established from empirical benchmark results during Milestone 7.
- **NFR-11.2 Model Reproducibility**: All intelligence predictions must log the exact `model_version`, training dataset snapshot identifier, input feature hash, and confidence score.
