# Functional Requirements Specification

## 1. Authentication & Identity (Provider-Neutral OIDC)
- **FR-1.1 Delegated Authentication**: Authentication is delegated to a provider-neutral OpenID Connect (OIDC) Identity Provider (IdP) such as Auth0, Keycloak, Clerk, or Okta.
- **FR-1.2 Identity Provider Ownership**: The IdP owns user credential storage (passwords), multi-factor authentication (MFA), password reset/recovery flows, and social/enterprise SSO federation.
- **FR-1.3 Token Verification**: The Go Core API acts as a Resource Server. It validates incoming JWT access tokens against the IdP's issuer (`iss`), audience (`aud`), and public JWKS endpoint.
- **FR-1.4 User Profile Provisioning**: Upon first successful authentication, PostgreSQL provisions an application user profile linked via the IdP's immutable external subject identifier (`external_subject_id` / `sub` claim). User passwords are **never** stored in PostgreSQL.

## 2. Organizations & Memberships
- **FR-2.1 Organization Creation**: Authenticated users can create organizations. The creating user's profile is automatically assigned the `OWNER` role in `organization_memberships`.
- **FR-2.2 Membership Management**: Owners and Administrators can invite members via email with assigned roles (`ADMINISTRATOR`, `ACCOUNTANT`, `ANALYST`, `AUDITOR_VIEWER`).
- **FR-2.3 Tenant Context Switching**: Users belonging to multiple organizations can switch their active workspace context cleanly without re-authenticating.

## 3. Organization Onboarding
- **FR-3.1 Onboarding Wizard**: Guide new organizations through initial currency selection (e.g. USD, EUR, GBP), fiscal year start month, and default Chart of Accounts template selection (e.g. Standard SMB, SaaS Standard).

## 4. CSV Transaction Import & Staging
- **FR-4.1 File Upload**: Support CSV transaction imports up to 50MB per batch.
- **FR-4.2 Column Mapping**: Interactive mapping interface for Date, Description, Amount, Reference Number, and Payee.
- **FR-4.3 Staged Transaction Pipeline**: Imported CSV rows are staged into `staged_transactions` with status `PENDING_REVIEW`.
- **FR-4.4 Duplicate Detection**: Automatically identify potential duplicate transactions based on `hash(date, amount, payee, reference)` within a configurable time window (e.g. 7 days).
- **FR-4.5 Validation Rules**: Reject invalid dates, malformed numbers, or missing required fields with line-by-line validation reports.

## 5. Transaction Review & Categorization
- **FR-5.1 Review Queue**: Unposted staged transactions land in an interactive Review Queue.
- **FR-5.2 Automated Suggestions**: AI engine assigns suggested category, confidence score (0.00 to 1.00), and explanation text (e.g. "Matches historical pattern for Vendor X").
- **FR-5.3 Human Approval Required**: AI suggestions are strictly advisory and CANNOT automatically post journal entries. An authorized user (`ACCOUNTANT` or higher) must explicitly approve, modify, or reject suggestions before posting into the ledger.

## 6. Chart of Accounts (COA)
- **FR-6.1 Account Hierarchy**: Tree-structured Chart of Accounts supporting standard types: Asset, Liability, Equity, Revenue, Expense.
- **FR-6.2 Account Codes**: Unique alphanumeric account codes per organization (e.g. `1010` - Cash, `4000` - Subscription Revenue).
- **FR-6.3 Activation/Deactivation**: Accounts can be archived if zero balance and no posted activity in open periods.

## 7. Journal Entries & Double-Entry Posting
- **FR-7.1 Double-Entry Enforcement**: Posting engine requires total debits to equal total credits ($\sum \text{Debits} = \sum \text{Credits}$).
- **FR-7.2 Fixed Precision**: Monetary values MUST be stored as integer minor units or `NUMERIC(20,4)`. Floating-point arithmetic is strictly forbidden.
- **FR-7.3 Entry Immutability**: Posted journal entries cannot be edited or deleted. Status transitions: `DRAFT` -> `POSTED`.
- **FR-7.4 Atomic Mutation & Audit**: Financial entry posting and corresponding `audit_logs` record insertion MUST execute atomically in the same PostgreSQL transaction.

## 8. Reversals & Fiscal Period Locking
- **FR-8.1 Reversal Entries**: Corrections to posted entries must create a linked Reversal Journal Entry that negates the original debits/credits with an audit reference to the original entry.
- **FR-8.2 Fiscal Period Lock**: Administrators can lock monthly/annual accounting periods. Any attempt to post into a locked period returns a validation error.

## 9. Dashboard & Financial Reports
- **FR-9.1 Real-Time Financial Statements**: Generate Income Statement (P&L), Balance Sheet, Trial Balance, and Cash Flow Statement on demand.
- **FR-9.2 Key Metrics Dashboard**: Display Cash Runway, Burn Rate, Monthly Recurring Revenue (MRR), Expense by Category, and Working Capital.

## 10. Audit Trail & Compliance
- **FR-10.1 Immutable Audit Log**: Append-only log recording all organization mutations.
- **FR-10.2 Audit Payload**: Each log captures `organization_id`, `actor_id`, `timestamp_utc`, `correlation_id`, `entity_type`, `entity_id`, `action`, and `change_delta`.

## 11. Notifications & Alerts
- **FR-11.1 Event Notifications**: In-app and email notifications for period close reminders, unreviewed transaction thresholds, anomaly alerts, and member role changes.

## 12. Anomaly Detection
- **FR-12.1 Statistical & ML Scanning**: Identify unusual transactions based on z-score variance, vendor baseline shifts, duplicate invoice patterns, or unexpected expense spikes.
- **FR-12.2 Alert Queue**: Flagged anomalies appear in an Audit Review Queue for Accountant inspection.

## 13. Forecasting & Scenario Modelling
- **FR-13.1 Cash Flow Projection**: Time-series forecasting projecting 30/60/90-day cash positions.
- **FR-13.2 What-If Scenario Builder**: Adjust revenue growth assumptions or expense increases to evaluate cash runway impact.

## 14. Explainability & Human Approval
- **FR-14.1 Transparent AI**: Every machine-generated recommendation must display:
  - Model Version
  - Confidence Score (0.00 to 1.00)
  - Top Influencing Factors / Feature Explanations
- **FR-14.2 Mandatory Human Approval**: High-value journal postings or suggestions generated by AI require explicit human approval before posting. Automatic posting by AI is strictly prohibited.

## 15. Subscription Limits & Usage Tracking
- **FR-15.1 Usage Tier Metering**: Track monthly transaction volume, member count, and storage usage against tenant plan limits.
- **FR-15.2 Soft & Hard Enforcement**: Warn admins at 80% limit; block batch imports exceeding hard limits.

## 16. Export & Data Retention Management
- **FR-16.1 Data Export**: Export general ledger, audit logs, and reports in standard formats (CSV, JSON, PDF).
- **FR-16.2 Jurisdiction-Configurable Retention**: Audit logs and financial records retention policies are jurisdiction-configurable (e.g. 5, 7, or 10 years based on local regulatory requirements).
- **FR-16.3 Organization Soft/Hard Deletion**: Owner can request organization termination with 30-day grace period before permanent purge.
