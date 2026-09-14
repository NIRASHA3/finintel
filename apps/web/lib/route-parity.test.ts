import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ROUTE_ALLOWLIST, UUID_PATTERN } from "./proxy/proxy-handler";

describe("Four-Way Route Parity: BFF Allowlist ↔ OpenAPI ↔ Go Router ↔ API Client", () => {
  it("verifies every OpenAPI endpoint has an exact matching rule in BFF ROUTE_ALLOWLIST", () => {
    // Read openapi.yaml
    const openapiPath = path.resolve(__dirname, "../../../contracts/openapi/openapi.yaml");
    const content = fs.readFileSync(openapiPath, "utf-8");

    const pathBlockRegex = /^\s\s(\/api\/v1\/[^\s:]+):\s*\n((?:\s\s\s\s[^\n]+\n)+)/gm;
    const methodRegex = /^\s\s\s\s(get|post|put|delete|patch):/gm;

    const openapiRoutes: { method: string; path: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = pathBlockRegex.exec(content)) !== null) {
      const routePath = match[1].replace(/^\/api\/v1\//, "").replace(/\/$/, "");
      const block = match[2];

      let methodMatch: RegExpExecArray | null;
      while ((methodMatch = methodRegex.exec(block)) !== null) {
        openapiRoutes.push({
          method: methodMatch[1].toUpperCase(),
          path: routePath,
        });
      }
    }

    expect(openapiRoutes.length).toBeGreaterThan(0);

    const testUUID = "123e4567-e89b-12d3-a456-426614174000";

    for (const route of openapiRoutes) {
      // Substitute OpenAPI path parameters {organizationId}, {memberId}, {entryId}, {periodId}, {id}
      const concretePath = route.path
        .replace(/\{[a-zA-Z0-9_-]+\}/g, testUUID);

      const matchingRule = ROUTE_ALLOWLIST.find(
        (r) => r.method === route.method && r.pathPattern.test(concretePath)
      );

      expect(
        matchingRule,
        `OpenAPI route '${route.method} /api/v1/${route.path}' (tested as '${concretePath}') must match a rule in BFF ROUTE_ALLOWLIST`
      ).toBeDefined();
    }
  });

  it("verifies every BFF allowlist rule matches at least one defined OpenAPI endpoint", () => {
    const openapiPath = path.resolve(__dirname, "../../../contracts/openapi/openapi.yaml");
    const content = fs.readFileSync(openapiPath, "utf-8");

    const pathBlockRegex = /^\s\s(\/api\/v1\/[^\s:]+):\s*\n((?:\s\s\s\s[^\n]+\n)+)/gm;
    const methodRegex = /^\s\s\s\s(get|post|put|delete|patch):/gm;

    const openapiSet = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = pathBlockRegex.exec(content)) !== null) {
      const routePath = match[1].replace(/^\/api\/v1\//, "").replace(/\/$/, "");
      const block = match[2];

      let methodMatch: RegExpExecArray | null;
      while ((methodMatch = methodRegex.exec(block)) !== null) {
        const normalized = `${methodMatch[1].toUpperCase()} ${routePath}`;
        openapiSet.add(normalized);
      }
    }

    // Standard test UUID
    const testUUID = "123e4567-e89b-12d3-a456-426614174000";

    for (const rule of ROUTE_ALLOWLIST) {
      let matched = false;
      for (const openapiRoute of openapiSet) {
        const [method, routePath] = openapiRoute.split(" ");
        if (rule.method !== method) continue;

        const concretePath = routePath.replace(/\{[a-zA-Z0-9_-]+\}/g, testUUID);
        if (rule.pathPattern.test(concretePath)) {
          matched = true;
          break;
        }
      }
      expect(
        matched,
        `BFF allowlist rule '${rule.method} ${rule.pathPattern}' must have a corresponding endpoint in OpenAPI spec`
      ).toBe(true);
    }
  });

  it("exercises real exported api-client functions with a mocked fetch layer and verifies allowlist parity", async () => {
    const testUUID = "123e4567-e89b-12d3-a456-426614174000";
    const capturedRequests: { method: string; path: string; queryParams: string[] }[] = [];

    const originalFetch = global.fetch;
    const mockedFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      const method = (init?.method || "GET").toUpperCase();

      // Mock CSRF session endpoint
      if (urlStr.includes("/api/auth/session")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ csrfToken: "mock-csrf-token" }),
          blob: async () => new Blob(),
        } as unknown as Response;
      }

      // Parse path and query
      const url = new URL(urlStr, "http://localhost");
      const cleanedPath = url.pathname
        .replace(/^\/api\/proxy\//, "")
        .replace(/^\/api\/v1\//, "")
        .replace(/^api\/v1\//, "")
        .replace(/\/$/, "");
      const queryParams = Array.from(url.searchParams.keys());

      capturedRequests.push({
        method,
        path: cleanedPath,
        queryParams,
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          organizations: [],
          accounts: [],
          entries: [],
          stagedTransactions: [],
          fiscalPeriods: [],
          auditLogs: [],
          anomalies: [],
          matches: [],
          subscriptions: [],
          rates: [],
          members: [],
        }),
        blob: async () => new Blob(["test"], { type: "text/csv" }),
      } as unknown as Response;
    });

    global.fetch = mockedFetch as unknown as typeof fetch;

    // Dynamically import api-client module to exercise real exported functions
    const apiClient = await import("./api-client");

    try {
      // Exercise all real exported API client functions
      await apiClient.fetchCurrentUser();
      await apiClient.fetchUserOrganizations();
      await apiClient.createOrganization({ name: "Test Corp", baseCurrency: "USD", fiscalYearStartMonth: 1 });
      await apiClient.fetchAccounts(testUUID);
      await apiClient.seedDefaultAccounts(testUUID);
      await apiClient.createAccount(testUUID, { accountCode: "1000", name: "Cash", accountType: "ASSET" });
      await apiClient.fetchJournalEntries(testUUID, "cursor123", 25);
      await apiClient.postJournalEntry(testUUID, { transactionDate: "2026-01-01", description: "Entry 1", lines: [] });
      await apiClient.fetchJournalEntry(testUUID, testUUID);
      await apiClient.postJournalEntryReversal(testUUID, testUUID, "Test Reversal");
      await apiClient.fetchStagedTransactions(testUUID, "PENDING");
      await apiClient.uploadCSVStagedTransactions(testUUID, "date,desc,amount\n2026-01-01,Test,100");
      await apiClient.approveStagedTransaction(testUUID, testUUID, testUUID);
      await apiClient.rejectStagedTransaction(testUUID, testUUID);
      await apiClient.batchPostStagedTransactions(testUUID);
      await apiClient.fetchFiscalPeriods(testUUID);
      await apiClient.generateFiscalPeriods(testUUID, 2026);
      await apiClient.closeFiscalPeriod(testUUID, testUUID);
      await apiClient.lockFiscalPeriod(testUUID, testUUID);
      await apiClient.unlockFiscalPeriod(testUUID, testUUID);
      await apiClient.fetchTrialBalance(testUUID, "2026-12-31");
      await apiClient.fetchIncomeStatement(testUUID, "2026-01-01", "2026-12-31");
      await apiClient.fetchBalanceSheet(testUUID, "2026-12-31");
      await apiClient.fetchAuditLogs(testUUID, 50, "cursor456");
      await apiClient.fetchAnomalies(testUUID);
      await apiClient.fetchDashboardMetrics(testUUID);
      await apiClient.autoMatchReconciliation(testUUID, []);
      await apiClient.fetchWebhookSubscriptions(testUUID);
      await apiClient.createWebhookSubscription(testUUID, "https://example.com/webhook", ["entry.posted"]);
      await apiClient.deleteWebhookSubscription(testUUID, testUUID);
      await apiClient.fetchFxRates(testUUID);
      await apiClient.upsertFxRate(testUUID, "USD", "EUR", 0.92, "2026-01-01");
      await apiClient.runFxRevaluation(testUUID, "USD", "EUR", 1000);
      await apiClient.fetchOrganizationMembers(testUUID);
      await apiClient.addOrganizationMember(testUUID, "member@test.com", "ACCOUNTANT");
      await apiClient.updateMemberRole(testUUID, testUUID, "ADMINISTRATOR");
      await apiClient.removeOrganizationMember(testUUID, testUUID);

      // Verify each captured request against ROUTE_ALLOWLIST
      expect(capturedRequests.length).toBeGreaterThanOrEqual(35);

      for (const req of capturedRequests) {
        const matchingRule = ROUTE_ALLOWLIST.find(
          (r) => r.method === req.method && r.pathPattern.test(req.path)
        );

        expect(
          matchingRule,
          `Real client call '${req.method} /api/v1/${req.path}' must match a rule in ROUTE_ALLOWLIST`
        ).toBeDefined();

        // Verify that every query parameter used by the real client is in allowedQueryParams
        for (const queryParam of req.queryParams) {
          expect(
            matchingRule?.allowedQueryParams,
            `Rule for '${req.method} /api/v1/${req.path}' must allow query param '${queryParam}'`
          ).toBeDefined();
          expect(
            matchingRule?.allowedQueryParams,
            `Rule for '${req.method} /api/v1/${req.path}' must include query param '${queryParam}'`
          ).toContain(queryParam);
        }
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});
