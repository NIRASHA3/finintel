export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  identityProviderIssuer: string;
  externalSubjectId: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  role: string;
  createdAt: string;
}

export interface CreateOrganizationParams {
  name: string;
  baseCurrency?: string;
  fiscalYearStartMonth?: number;
}

export interface Account {
  id: string;
  organizationId: string;
  accountCode: string;
  name: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  isActive: boolean;
}

export interface CreateAccountParams {
  accountCode: string;
  name: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
}

export interface JournalEntryLineRequest {
  accountId: string;
  debitAmountMinorUnits: number;
  creditAmountMinorUnits: number;
  memo?: string;
}

export interface JournalEntryLine {
  id: string;
  organizationId: string;
  journalEntryId: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debitAmountMinorUnits: number;
  creditAmountMinorUnits: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  organizationId: string;
  entryNumber: number;
  transactionDate: string;
  description: string;
  status: string;
  reversedByEntryId?: string;
  postedByUserId?: string;
  createdAt: string;
  lines: JournalEntryLine[];
}

export interface PostJournalEntryParams {
  transactionDate: string;
  description: string;
  lines: JournalEntryLineRequest[];
}

export interface StagedTransaction {
  id: string;
  organizationId: string;
  transactionDate: string;
  description: string;
  amountMinorUnits: number;
  rawDataHash: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "POSTED";
  suggestedAccountId?: string;
  suggestedAccountCode?: string;
  suggestedAccountName?: string;
  confidenceScore: number;
  createdAt: string;
}

export interface BatchPostResult {
  postedEntriesCount: number;
  totalDebitsMinorUnits: number;
  totalCreditsMinorUnits: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function fetchCurrentUser(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch current user profile: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchUserOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user organizations: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.organizations || [];
}

export async function createOrganization(params: CreateOrganizationParams): Promise<Organization> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      baseCurrency: params.baseCurrency || "USD",
      fiscalYearStartMonth: params.fiscalYearStartMonth || 1,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create organization: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchAccounts(orgId: string): Promise<Account[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/accounts`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Chart of Accounts: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.accounts || [];
}

export async function seedDefaultAccounts(orgId: string): Promise<Account[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/accounts/seed`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to seed default accounts: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.accounts || [];
}

export async function createAccount(orgId: string, params: CreateAccountParams): Promise<Account> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/accounts`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create account: HTTP ${res.status}`);
  }

  return res.json();
}

export interface JournalEntriesResponse {
  entries: JournalEntry[];
  nextCursor?: string | null;
}

export async function fetchJournalEntries(
  orgId: string,
  cursor?: string,
  limit: number = 50
): Promise<JournalEntriesResponse> {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  if (limit) params.append("limit", limit.toString());
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/journal-entries${query}`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch journal entries: HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    entries: data.entries || [],
    nextCursor: data.next_cursor || null,
  };
}

export async function postJournalEntry(orgId: string, params: PostJournalEntryParams): Promise<JournalEntry> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/journal-entries`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to post journal entry: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchStagedTransactions(orgId: string, status?: string): Promise<StagedTransaction[]> {
  const query = status && status !== "ALL" ? `?status=${status}` : "";
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/staged-transactions${query}`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch staged transactions: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.stagedTransactions || [];
}

export async function uploadCSVStagedTransactions(orgId: string, fileOrContent: File | string): Promise<{ insertedCount: number; message: string }> {
  let body: any;
  const headers: Record<string, string> = {
    Authorization: "Bearer dev-token-admin@finintel.io",
  };

  if (typeof fileOrContent === "string") {
    body = fileOrContent;
    headers["Content-Type"] = "text/csv";
  } else {
    const formData = new FormData();
    formData.append("file", fileOrContent);
    body = formData;
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/staged-transactions/upload`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to upload CSV: HTTP ${res.status}`);
  }

  return res.json();
}

export async function approveStagedTransaction(orgId: string, id: string, accountId?: string): Promise<StagedTransaction> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/staged-transactions/${id}/approve`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to approve staged transaction: HTTP ${res.status}`);
  }

  return res.json();
}

export async function rejectStagedTransaction(orgId: string, id: string): Promise<StagedTransaction> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/staged-transactions/${id}/reject`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to reject staged transaction: HTTP ${res.status}`);
  }

  return res.json();
}

export async function batchPostStagedTransactions(orgId: string): Promise<BatchPostResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/staged-transactions/batch-post`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to batch post approved transactions: HTTP ${res.status}`);
  }

  return res.json();
}

// Phase 5 Interfaces
export interface AccountReportLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  debitAmountMinorUnits: number;
  creditAmountMinorUnits: number;
  netBalanceMinorUnits: number;
}

export interface TrialBalanceReport {
  asOfDate: string;
  accounts: AccountReportLine[];
  totalDebitsMinorUnits: number;
  totalCreditsMinorUnits: number;
  isBalanced: boolean;
}

export interface IncomeStatementReport {
  startDate: string;
  endDate: string;
  revenueAccounts: AccountReportLine[];
  expenseAccounts: AccountReportLine[];
  totalRevenueMinorUnits: number;
  totalExpensesMinorUnits: number;
  netIncomeMinorUnits: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assetAccounts: AccountReportLine[];
  liabilityAccounts: AccountReportLine[];
  equityAccounts: AccountReportLine[];
  totalAssetsMinorUnits: number;
  totalLiabilitiesMinorUnits: number;
  directEquityMinorUnits: number;
  retainedEarningsMinorUnits: number;
  totalEquityMinorUnits: number;
  totalLiabilitiesAndEquityMinorUnits: number;
  isBalanced: boolean;
  equationDeltaMinorUnits: number;
}

export interface FiscalPeriod {
  id: string;
  organizationId: string;
  fiscalYear: number;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED" | "LOCKED";
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId?: string;
  actorEmail?: string;
  actorFullName?: string;
  actorType: string;
  correlationId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, any>;
  createdAt: string;
}

// Phase 5 API Functions
export async function fetchTrialBalance(orgId: string, asOfDate?: string): Promise<TrialBalanceReport> {
  const query = asOfDate ? `?asOfDate=${asOfDate}` : "";
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/reports/trial-balance${query}`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Trial Balance report: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchIncomeStatement(orgId: string, startDate?: string, endDate?: string): Promise<IncomeStatementReport> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/reports/income-statement${query}`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Income Statement report: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchBalanceSheet(orgId: string, asOfDate?: string): Promise<BalanceSheetReport> {
  const query = asOfDate ? `?asOfDate=${asOfDate}` : "";
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/reports/balance-sheet${query}`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Balance Sheet report: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchFiscalPeriods(orgId: string): Promise<FiscalPeriod[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/fiscal-periods`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch fiscal periods: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.fiscalPeriods || [];
}

export async function generateFiscalPeriods(orgId: string, fiscalYear?: number): Promise<FiscalPeriod[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/fiscal-periods/generate`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fiscalYear }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to generate fiscal periods: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.fiscalPeriods || [];
}

export async function closeFiscalPeriod(orgId: string, periodId: string): Promise<FiscalPeriod> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/fiscal-periods/${periodId}/close`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to close fiscal period: HTTP ${res.status}`);
  }

  return res.json();
}

export async function lockFiscalPeriod(orgId: string, periodId: string): Promise<FiscalPeriod> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/fiscal-periods/${periodId}/lock`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to lock fiscal period: HTTP ${res.status}`);
  }

  return res.json();
}

export async function unlockFiscalPeriod(orgId: string, periodId: string): Promise<FiscalPeriod> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/fiscal-periods/${periodId}/unlock`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to unlock fiscal period: HTTP ${res.status}`);
  }

  return res.json();
}

export interface AuditLogsResponse {
  auditLogs: AuditLog[];
  nextCursor?: string | null;
}

export async function fetchAuditLogs(
  orgId: string,
  limit: number = 100,
  cursor?: string
): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (limit) params.append("limit", limit.toString());
  if (cursor) params.append("cursor", cursor);
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/audit-logs${query}`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch audit logs: HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    auditLogs: data.auditLogs || [],
    nextCursor: data.next_cursor || null,
  };
}

// Phase 6 Interfaces & API Functions
export interface Anomaly {
  id: string;
  type: "DUPLICATE_REFERENCE" | "OUTLIER_AMOUNT" | "UNMAPPED_PAYEE";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  confidenceScore: number;
  suggestedAction: string;
  createdAt: string;
  relatedEntityId?: string;
}

export interface ExpenseCategoryBreakdown {
  accountCode: string;
  accountName: string;
  amountMinor: number;
  percentage: number;
}

export interface DashboardMetrics {
  organizationId: string;
  workingCapitalMinorUnits: number;
  cashPositionMinorUnits: number;
  monthlyBurnRateMinorUnits: number;
  runwayMonths: number;
  ytdRevenueMinorUnits: number;
  ytdExpenseMinorUnits: number;
  netIncomeMinorUnits: number;
  expenseBreakdown: ExpenseCategoryBreakdown[];
}

export async function postJournalEntryReversal(orgId: string, entryId: string, reason: string): Promise<JournalEntry> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/journal-entries/${entryId}/reverse`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `Failed to post entry reversal: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchAnomalies(orgId: string): Promise<Anomaly[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/anomalies`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch anomalies: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.anomalies || [];
}

export async function fetchDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/dashboard/metrics`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch executive dashboard metrics: HTTP ${res.status}`);
  }

  return res.json();
}

export async function downloadLedgerCSV(orgId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/export/ledger`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to export ledger CSV: HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finintel_ledger_${orgId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadAuditLogsCSV(orgId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/export/audit`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to export audit logs CSV: HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finintel_audit_logs_${orgId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Phase 7 Interfaces & API Functions
export interface ReconciliationMatch {
  id: string;
  bankTransactionId: string;
  bankDate: string;
  bankAmountMinorUnits: number;
  bankReference: string;
  matchedEntry?: {
    entryId: string;
    entryNumber: number;
    transactionDate: string;
    description: string;
    amountMinorUnits: number;
  };
  confidenceScore: number;
  matchStatus: "EXACT_MATCH" | "HIGH_CONFIDENCE" | "SUGGESTED" | "UNMATCHED" | "MANUALLY_MATCHED";
  discrepancyReason?: string;
}

export interface WebhookSubscription {
  id: string;
  organization_id: string;
  target_url: string;
  secret_token: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export interface FxRate {
  id: string;
  organization_id: string;
  base_currency: string;
  target_currency: string;
  rate: number;
  effective_date: string;
  updated_at: string;
}

export interface FxRevaluationResult {
  id: string;
  organization_id: string;
  revaluation_date: string;
  base_currency: string;
  foreign_currency: string;
  original_foreign_amount: number;
  booked_base_amount: number;
  current_rate: number;
  revalued_base_amount: number;
  unrealized_gain_loss: number;
  status: string;
  journal_entry_id?: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: "Admin" | "Controller" | "Accountant" | "Auditor";
  status: string;
  created_at: string;
}

export async function autoMatchReconciliation(orgId: string, transactions: any[]): Promise<ReconciliationMatch[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/reconciliations/match`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "X-Organization-ID": orgId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transactions }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to run auto-match reconciliation: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.matches || [];
}

export async function fetchWebhookSubscriptions(orgId: string): Promise<WebhookSubscription[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/webhooks/subscriptions`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "X-Organization-ID": orgId,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch webhook subscriptions: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.subscriptions || [];
}

export async function createWebhookSubscription(orgId: string, targetUrl: string, events: string[]): Promise<WebhookSubscription> {
  const res = await fetch(`${API_BASE_URL}/api/v1/webhooks/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "X-Organization-ID": orgId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_url: targetUrl, events }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create webhook subscription: HTTP ${res.status}`);
  }

  return res.json();
}

export async function deleteWebhookSubscription(orgId: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/webhooks/subscriptions/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "X-Organization-ID": orgId,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to delete webhook subscription: HTTP ${res.status}`);
  }
}

export async function fetchFxRates(orgId: string): Promise<FxRate[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/fx-rates`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "X-Organization-ID": orgId,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch FX exchange rates: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.rates || [];
}

export async function upsertFxRate(orgId: string, baseCurrency: string, targetCurrency: string, rate: number, effectiveDate?: string): Promise<FxRate> {
  const res = await fetch(`${API_BASE_URL}/api/v1/fx-rates`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "X-Organization-ID": orgId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base_currency: baseCurrency, target_currency: targetCurrency, rate, effective_date: effectiveDate }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to save exchange rate: HTTP ${res.status}`);
  }

  return res.json();
}

export async function runFxRevaluation(orgId: string, baseCurrency: string, foreignCurrency: string, foreignAmount: number): Promise<FxRevaluationResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/fx-rates/revalue`, {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "X-Organization-ID": orgId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base_currency: baseCurrency, foreign_currency: foreignCurrency, foreign_amount: foreignAmount }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to run FX revaluation: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchOrganizationMembers(orgId: string): Promise<OrgMember[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/members`, {
    headers: {
      Authorization: "Bearer dev-token-admin@finintel.io",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch organization members: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.members || [];
}


