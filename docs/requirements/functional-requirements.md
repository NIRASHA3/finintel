# Functional Requirements Specification

## 1. Authentication & Account Recovery
- **FR-1.1 Password Authentication**: Users can log in using email and password. Passwords must be hashed using Argon2id or bcrypt with cost factor >= 12.
- **FR-1.2 Multi-Factor Authentication (MFA)**: Support TOTP-based two-factor authentication.
- **FR-1.3 Session Management**: Issue secure, HTTP-only JWT access tokens (short-lived, e.g. 15 min) and refresh tokens stored in secure database records.
- **FR-1.4 Account Recovery**: Secure password reset flow via cryptographically random token sent via email, valid for 30 minutes.

## 2. Organizations & Memberships
- **FR-2.1 Organization Creation**: Authenticated users can create one or more organizations. The creator automatically becomes the `Owner`.
- **FR-2.2 Membership Management**: Owners and Administrators can invite members via email with assigned roles (`Administrator`, `Accountant`, `Analyst`, `Auditor/Viewer`).
- **FR-2.3 Tenant Switching**: Multi-organization users can switch their active workspace context cleanly without re-authenticating.

## 3. Organization Onboarding
- **FR-3.1 Onboarding Wizard**: Guide new organizations through initial currency selection (e.g. USD, EUR, GBP), fiscal year start month, and default Chart of Accounts template selection (e.g. Standard SMB, SaaS Standard).

## 4. CSV Transaction Import & Validation
- **FR-4.1 File Upload**: Support CSV transaction imports up to 50MB per batch.
- **FR-4.2 Column Mapping**: Interactive mapping interface for Date, Description, Amount, Reference Number, and Payee.
- **FR-4.3 Duplicate Detection**: Automatically identify potential duplicate transactions based on `hash(date, amount, payee, reference)` within a configurable time window (e.g. 7 days).
- **FR-4.4 Validation Rules**: Reject invalid dates, malformed numbers, or missing required fields with line-by-line validation reports.

## 5. Transaction Review & Categorization
- **FR-5.1 Review Queue**: Unposted imported transactions land in a staged Review Queue.
- **FR-5.2 Automated Suggestions**: AI engine assigns suggested category, confidence score (0-100%), and human-readable explanation (e.g. "Matches historical pattern for Vendor X").
- **FR-5.3 Manual Review & Approval**: Accountants can accept suggestions, modify categories, or split transactions across multiple accounts.

## 6. Chart of Accounts (COA)
- **FR-6.1 Account Hierarchy**: Tree-structured Chart of Accounts supporting standard types: Asset, Liability, Equity, Revenue, Expense.
- **FR-6.2 Account Codes**: Unique alphanumeric account codes per organization (e.g. `1010` - Cash, `4000` - Subscription Revenue).
- **FR-6.3 Activation/Deactivation**: Accounts can be archived if zero balance and no posted activity in open periods.

## 7. Journal Entries & Double-Entry Posting
- **FR-7.1 Double-Entry Enforcement**: Posting engine requires total debits to equal total credits ($\sum \text{Debits} = \sum \text{Credits}$).
- **FR-7.2 Fixed Precision**: Monetary values stored as integer minor units or `NUMERIC(20,4)`. Floating point arithmetic is strictly forbidden.
- **FR-7.3 Entry Immutability**: Posted journal entries cannot be edited or deleted. Status transitions: `DRAFT` -> `POSTED`.

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
- **FR-13.1 Cash Flow Projection**: Time-series forecasting (Prophet/ARIMA/Exponential Smoothing) projecting 30/60/90-day cash positions.
- **FR-13.2 What-If Scenario Builder**: Adjust revenue growth assumptions or expense increases to evaluate cash runway impact.

## 14. Explainability & Human Approval
- **FR-14.1 Transparent AI**: Every machine-generated recommendation must display:
  - Model Version
  - Confidence Score (%)
  - Top 3 Influencing Factors / Feature Explanations
- **FR-14.2 Human-in-the-Loop**: High-value journal postings generated by AI require explicit human approval before posting.

## 15. Subscription Limits & Usage Tracking
- **FR-15.1 Usage Tier Metering**: Track monthly transaction volume, member count, and storage usage against tenant plan limits.
- **FR-15.2 Soft & Hard Enforcement**: Warn admins at 80% limit; block batch imports exceeding hard limits.

## 16. Export & Organization Deletion
- **FR-16.1 Data Export**: Export general ledger, audit logs, and reports in standard formats (CSV, JSON, PDF).
- **FR-16.2 Organization Soft/Hard Deletion**: Owner can request organization termination with 30-day grace period before permanent purge.
