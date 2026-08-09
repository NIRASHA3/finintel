# Non-Functional Requirements (NFR) Specification

## 1. Tenant Isolation & Data Security
- **NFR-1.1 Strict Logical Isolation**: Every database query must filter by `organization_id`. Cross-tenant data leaks are zero-tolerance defects.
- **NFR-1.2 Encryption Standards**: Data in transit must use TLS 1.3. Data at rest must be encrypted using AES-256 (PostgreSQL transparent data encryption or encrypted volume storage).
- **NFR-1.3 Zero Trust Architecture**: API controllers must validate JWT signature, organization membership, and exact role permission on every request.

## 2. Data Integrity & Financial Precision
- **NFR-2.1 Exact Arithmetic**: Monetary values MUST be stored as integer minor units or fixed-precision `NUMERIC(20,4)`. IEEE 754 floating-point arithmetic is prohibited for currency.
- **NFR-2.2 ACID Guarantees**: All financial journal postings and period closing operations MUST run within isolated PostgreSQL transactions (`SERIALIZABLE` or `REPEATABLE READ`).
- **NFR-2.3 Idempotency**: Financial posting API endpoints and webhooks MUST guarantee idempotency via `Idempotency-Key` headers.

## 3. Accessibility (a11y)
- **NFR-3.1 WCAG Compliance**: Next.js frontend components must comply with WCAG 2.1 Level AA standards.
- **NFR-3.2 Screen Reader & Keyboard Support**: Complete keyboard navigation support and ARIA attributes for dynamic modal dialogs, tables, and financial forms.

## 4. Performance & Response Times
- **NFR-4.1 API Latency**: 95% of standard read requests (`GET /api/v1/...`) must respond in < 150ms.
- **NFR-4.2 Financial Posting Latency**: 99% of single journal entry postings must execute in < 250ms.
- **NFR-4.3 Batch CSV Import**: Support importing 10,000 transactions in < 10 seconds via async background worker processing.

## 5. Availability & Uptime
- **NFR-5.1 Service Availability**: Target 99.9% uptime (excluding scheduled maintenance windows).
- **NFR-5.2 Graceful Degradation**: If the Python Intelligence service is unreachable, the Go API must remain 100% operational for manual entry, review, and reporting.

## 6. Scalability & Workload Management
- **NFR-6.1 Stateless Backend**: Go API and Python Intelligence services must be completely stateless to allow horizontal scaling behind a load balancer.
- **NFR-6.2 Database Connection Pooling**: Go API must use `pgxpool` with strict connection limits (`DATABASE_MAX_CONNS`).

## 7. Observability & Telemetry
- **NFR-7.1 Structured Logging**: All application logs must be output as JSON to `stdout` containing `timestamp`, `level`, `service`, `organization_id`, `correlation_id`, and `message`.
- **NFR-7.2 Metrics & Distributed Tracing**: Expose Prometheus metrics (`/metrics`) and propagate OpenTelemetry trace contexts (`W3C Trace Context`) across Web, API, and Intelligence services.

## 8. Backup, Recovery & Disaster Recovery
- **NFR-8.1 Point-in-Time Recovery (PITR)**: Managed PostgreSQL must maintain continuous WAL archiving enabling PITR restore to any point within the past 30 days.
- **NFR-8.2 Recovery Objectives**: Recovery Point Objective (RPO) < 5 minutes; Recovery Time Objective (RTO) < 2 hours.

## 9. Privacy & Compliance
- **NFR-9.1 Log Sanitization**: Automatically strip passwords, credit card numbers, authorization tokens, and PII from log aggregators.
- **NFR-9.2 Audit Retention**: Immutable audit logs must be preserved for at least 7 years to comply with statutory accounting requirements.

## 10. Maintainability & Code Quality
- **NFR-10.1 Test Coverage**: Minimum 80% code coverage on Go API business/accounting packages and Python data transformation utilities.
- **NFR-10.2 Type Safety**: Strict TypeScript (`strict: true`) on Web frontend and fully type-hinted Go and Python services.

## 11. AI Quality & Model Reproducibility
- **NFR-11.1 Categorization Accuracy**: Automated ML categorization suggestion engine must achieve >= 85% precision on standard transaction training sets.
- **NFR-11.2 Model Reproducibility**: All intelligence predictions must log the exact `model_version`, training dataset snapshot identifier, and input feature hash.
