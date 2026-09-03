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

export async function fetchJournalEntries(orgId: string): Promise<JournalEntry[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/journal-entries`, {
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
  return data.entries || [];
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
