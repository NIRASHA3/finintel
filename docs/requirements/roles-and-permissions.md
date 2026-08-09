# Roles & Permissions Specification

## 1. Role Definitions

### 1.1 Owner
- **Scope**: Primary organization administrator and billing owner.
- **Capabilities**: Full access to all organization settings, subscription plans, member management, financial data, ledger postings, period locks, and organization deletion requests.

### 1.2 Administrator
- **Scope**: Operational administrator for an organization.
- **Capabilities**: Manage members (excluding Owner transfer/org deletion), configure Chart of Accounts, lock/unlock fiscal periods, manage integrations, and perform all accounting actions.

### 1.3 Accountant
- **Scope**: Core financial operational role.
- **Capabilities**: Import transactions, review and categorize staged transactions, create and post double-entry journal entries, execute reversals, manage Chart of Accounts, and generate financial statements. Cannot modify tenant settings or manage organization members.

### 1.4 Analyst
- **Scope**: Read-heavy operational role focused on forecasting and reporting.
- **Capabilities**: View financial statements and dashboards, inspect staged transactions, run what-if forecast models, view AI explanations, and export reports. Cannot post journal entries or modify Chart of Accounts.

### 1.5 Auditor / Viewer
- **Scope**: Read-only compliance and verification role.
- **Capabilities**: View financial reports, inspect posted journal entries, inspect immutable audit logs, view period lock status. Cannot modify any records or export bulk data beyond compliance scope.

### 1.6 System Worker
- **Scope**: Machine background service actor (`services/worker`).
- **Capabilities**: Execute async tasks, batch CSV parsing, background anomaly scanning, and generate PDF export artifacts under explicit organization context.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Domain Capability | Owner | Administrator | Accountant | Analyst | Auditor/Viewer | System Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Manage Subscription & Billing** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Delete Organization** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Invite & Remove Members** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Chart of Accounts** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lock / Unlock Fiscal Periods** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Import CSV Transactions** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Approve AI Categorization** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create & Post Journal Entries** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Execute Journal Reversals** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Run Forecasts & Scenarios** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Financial Reports** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Audit Trail Logs** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Background Processing** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Enforcement Invariants
1. Permissions MUST be evaluated on the backend in `services/api` for every API endpoint.
2. The user's role MUST be scoped to the specific `organization_id` supplied in the request context.
3. System Workers must authenticate via secure internal service tokens with correlation ID propagation.
