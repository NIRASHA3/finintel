export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  identityProviderIssuer?: string;
  externalSubjectId?: string;
  createdAt?: string;
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
  role: "OWNER" | "ADMINISTRATOR" | "ACCOUNTANT" | "ANALYST" | "AUDITOR_VIEWER";
  status: string;
  created_at: string;
}

export class PermissionDeniedError extends Error {
  constructor(message = "Permission denied for this action") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message = "Service is temporarily unavailable") {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

// In-Memory CSRF Token Cache
let cachedCsrfToken: string | null = null;

export async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrfToken || null;
      return cachedCsrfToken;
    }
  } catch (e) {
    console.warn("Failed to acquire CSRF token:", e);
  }
  return null;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  if (isMutation && !cachedCsrfToken) {
    await fetchCsrfToken();
  }

  const headers = new Headers(options.headers || {});
  if (isMutation && cachedCsrfToken) {
    headers.set("X-FinIntel-CSRF", cachedCsrfToken);
  }

  const targetUrl = path.startsWith("/api/auth") ? path : `/api/proxy${path}`;

  let res = await fetch(targetUrl, {
    ...options,
    headers,
    cache: "no-store",
  });

  // Automatically attempt one token refresh if 401 returned
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    try {
      const refreshRes = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: cachedCsrfToken ? { "X-FinIntel-CSRF": cachedCsrfToken } : {},
      });

      if (refreshRes.ok) {
        await fetchCsrfToken();
        // REQUIREMENT 4: Only retry safe/idempotent GET requests automatically
        if (method === "GET") {
          const retryHeaders = new Headers(options.headers || {});
          res = await fetch(targetUrl, {
            ...options,
            headers: retryHeaders,
            cache: "no-store",
          });
        } else {
          throw new Error("SESSION_EXPIRED: Session was refreshed. Please resubmit your request deliberately.");
        }
      }
    } catch (e: any) {
      if (e?.message?.startsWith("SESSION_EXPIRED")) {
        throw e;
      }
      // Refresh failed, proceed to handle original 401
    }
  }

  if (res.status === 403) {
    throw new PermissionDeniedError();
  }
  if (res.status === 503) {
    throw new ServiceUnavailableError();
  }

  return res;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const res = await apiFetch("/api/v1/users/me");
  if (!res.ok) {
    throw new Error(`Failed to fetch current user profile: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchUserOrganizations(): Promise<Organization[]> {
  const res = await apiFetch("/api/v1/organizations");
  if (!res.ok) {
    throw new Error(`Failed to fetch user organizations: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.organizations || [];
}

export async function createOrganization(params: CreateOrganizationParams): Promise<Organization> {
  const res = await apiFetch("/api/v1/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await apiFetch(`/api/v1/organizations/${orgId}/accounts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Chart of Accounts: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.accounts || [];
}

export async function seedDefaultAccounts(orgId: string): Promise<Account[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/accounts/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to seed default accounts: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.accounts || [];
}

export async function createAccount(orgId: string, params: CreateAccountParams): Promise<Account> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const res = await apiFetch(`/api/v1/organizations/${orgId}/journal-entries${query}`);
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
  const res = await apiFetch(`/api/v1/organizations/${orgId}/journal-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to post journal entry: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchJournalEntry(orgId: string, entryId: string): Promise<JournalEntry> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/journal-entries/${entryId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch journal entry: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchStagedTransactions(orgId: string, status?: string): Promise<StagedTransaction[]> {
  const query = status && status !== "ALL" ? `?status=${status}` : "";
  const res = await apiFetch(`/api/v1/organizations/${orgId}/staged-transactions${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch staged transactions: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.stagedTransactions || [];
}

export async function uploadCSVStagedTransactions(
  orgId: string,
  fileOrContent: File | string
): Promise<{ insertedCount: number; message: string }> {
  let body: any;
  const headers: Record<string, string> = {};

  if (typeof fileOrContent === "string") {
    body = fileOrContent;
    headers["Content-Type"] = "text/csv";
  } else {
    const formData = new FormData();
    formData.append("file", fileOrContent);
    body = formData;
  }

  const res = await apiFetch(`/api/v1/organizations/${orgId}/staged-transactions/upload`, {
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
  const res = await apiFetch(`/api/v1/organizations/${orgId}/staged-transactions/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to approve staged transaction: HTTP ${res.status}`);
  }

  return res.json();
}

export async function rejectStagedTransaction(orgId: string, id: string): Promise<StagedTransaction> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/staged-transactions/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to reject staged transaction: HTTP ${res.status}`);
  }

  return res.json();
}

export async function batchPostStagedTransactions(orgId: string): Promise<BatchPostResult> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/staged-transactions/batch-post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to batch post approved transactions: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchTrialBalance(orgId: string, asOfDate?: string): Promise<TrialBalanceReport> {
  const query = asOfDate ? `?asOfDate=${asOfDate}` : "";
  const res = await apiFetch(`/api/v1/organizations/${orgId}/reports/trial-balance${query}`);
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

  const res = await apiFetch(`/api/v1/organizations/${orgId}/reports/income-statement${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Income Statement report: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchBalanceSheet(orgId: string, asOfDate?: string): Promise<BalanceSheetReport> {
  const query = asOfDate ? `?asOfDate=${asOfDate}` : "";
  const res = await apiFetch(`/api/v1/organizations/${orgId}/reports/balance-sheet${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Balance Sheet report: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchFiscalPeriods(orgId: string): Promise<FiscalPeriod[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fiscal-periods`);
  if (!res.ok) {
    throw new Error(`Failed to fetch fiscal periods: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.fiscalPeriods || [];
}

export async function generateFiscalPeriods(orgId: string, fiscalYear?: number): Promise<FiscalPeriod[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fiscal-periods/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fiscal-periods/${periodId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to close fiscal period: HTTP ${res.status}`);
  }

  return res.json();
}

export async function lockFiscalPeriod(orgId: string, periodId: string): Promise<FiscalPeriod> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fiscal-periods/${periodId}/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to lock fiscal period: HTTP ${res.status}`);
  }

  return res.json();
}

export async function unlockFiscalPeriod(orgId: string, periodId: string): Promise<FiscalPeriod> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fiscal-periods/${periodId}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const res = await apiFetch(`/api/v1/organizations/${orgId}/audit-logs${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch audit logs: HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    auditLogs: data.auditLogs || [],
    nextCursor: data.next_cursor || null,
  };
}

export async function postJournalEntryReversal(orgId: string, entryId: string, reason: string): Promise<JournalEntry> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/journal-entries/${entryId}/reverse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `Failed to post entry reversal: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchAnomalies(orgId: string): Promise<Anomaly[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/anomalies`);
  if (!res.ok) {
    throw new Error(`Failed to fetch anomalies: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.anomalies || [];
}

export async function fetchDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/dashboard/metrics`);
  if (!res.ok) {
    throw new Error(`Failed to fetch executive dashboard metrics: HTTP ${res.status}`);
  }
  return res.json();
}

export async function downloadLedgerCSV(orgId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/export/ledger`);
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
  const res = await apiFetch(`/api/v1/organizations/${orgId}/export/audit`);
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

export async function autoMatchReconciliation(orgId: string, transactions: any[]): Promise<ReconciliationMatch[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/reconciliations/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await apiFetch(`/api/v1/organizations/${orgId}/webhooks/subscriptions`);
  if (!res.ok) {
    throw new Error(`Failed to fetch webhook subscriptions: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.subscriptions || [];
}

export async function createWebhookSubscription(orgId: string, targetUrl: string, events: string[]): Promise<WebhookSubscription> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/webhooks/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_url: targetUrl, events }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create webhook subscription: HTTP ${res.status}`);
  }

  return res.json();
}

export async function deleteWebhookSubscription(orgId: string, id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/webhooks/subscriptions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete webhook subscription: HTTP ${res.status}`);
  }
}

export async function fetchFxRates(orgId: string): Promise<FxRate[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fx-rates`);
  if (!res.ok) {
    throw new Error(`Failed to fetch FX exchange rates: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.rates || [];
}

export async function upsertFxRate(
  orgId: string,
  baseCurrency: string,
  targetCurrency: string,
  rate: number,
  effectiveDate?: string
): Promise<FxRate> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fx-rates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_currency: baseCurrency, target_currency: targetCurrency, rate, effective_date: effectiveDate }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to save exchange rate: HTTP ${res.status}`);
  }

  return res.json();
}

export async function runFxRevaluation(
  orgId: string,
  baseCurrency: string,
  foreignCurrency: string,
  foreignAmount: number
): Promise<FxRevaluationResult> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/fx-rates/revalue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_currency: baseCurrency, foreign_currency: foreignCurrency, foreign_amount: foreignAmount }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to run FX revaluation: HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchOrganizationMembers(orgId: string): Promise<OrgMember[]> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/members`);
  if (!res.ok) {
    throw new Error(`Failed to fetch organization members: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.members || [];
}

export async function updateMemberRole(orgId: string, memberId: string, role: string): Promise<OrgMember> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/members/${memberId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to update member role: HTTP ${res.status}`);
  }

  return res.json();
}

export async function addOrganizationMember(orgId: string, email: string, role: string): Promise<OrgMember> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to add member: HTTP ${res.status}`);
  }

  return res.json();
}

export async function removeOrganizationMember(orgId: string, memberId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/organizations/${orgId}/members/${memberId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to remove member: HTTP ${res.status}`);
  }
}
