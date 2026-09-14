"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchTrialBalance,
  fetchIncomeStatement,
  fetchBalanceSheet,
  TrialBalanceReport,
  IncomeStatementReport,
  BalanceSheetReport,
  Organization,
} from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import {
  CurrencyAmount,
  LoadingSkeleton,
  AlertBanner,
  EmptyState,
} from "./ui";

interface FinancialReportsViewProps {
  organization?: Organization;
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  organization: propOrg,
}) => {
  const { activeOrg } = useOrganization();
  const organization = propOrg || activeOrg;
  const currency = organization?.baseCurrency || "USD";

  const [activeReport, setActiveReport] = useState<"balance-sheet" | "income-statement" | "trial-balance">("balance-sheet");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const [tbReport, setTbReport] = useState<TrialBalanceReport | null>(null);
  const [isReport, setIsReport] = useState<IncomeStatementReport | null>(null);
  const [bsReport, setBsReport] = useState<BalanceSheetReport | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    try {
      if (activeReport === "balance-sheet") {
        const data = await fetchBalanceSheet(organization.id, asOfDate);
        setBsReport(data);
      } else if (activeReport === "income-statement") {
        const data = await fetchIncomeStatement(organization.id, startDate, endDate);
        setIsReport(data);
      } else if (activeReport === "trial-balance") {
        const data = await fetchTrialBalance(organization.id, asOfDate);
        setTbReport(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load financial report";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, activeReport, asOfDate, startDate, endDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  if (!organization) {
    return (
      <EmptyState
        title="No organization selected"
        description="Select an organization to compute financial reports."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Selection & Date Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-card">
        {/* Report Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveReport("balance-sheet")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition min-h-[44px] ${
              activeReport === "balance-sheet"
                ? "bg-[#15616D] text-white shadow-xs"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Balance Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveReport("income-statement")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition min-h-[44px] ${
              activeReport === "income-statement"
                ? "bg-[#15616D] text-white shadow-xs"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Income Statement (P&L)
          </button>
          <button
            type="button"
            onClick={() => setActiveReport("trial-balance")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition min-h-[44px] ${
              activeReport === "trial-balance"
                ? "bg-[#15616D] text-white shadow-xs"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Trial Balance
          </button>
        </div>

        {/* Date Filter Inputs */}
        <div className="flex flex-wrap items-center gap-3">
          {activeReport === "income-statement" ? (
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="report-start-date" className="text-xs font-semibold text-slate-500">From:</label>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg min-h-[36px]"
              />
              <label htmlFor="report-end-date" className="text-xs font-semibold text-slate-500">To:</label>
              <input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg min-h-[36px]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="report-as-of-date" className="text-xs font-semibold text-slate-500">As of Date (UTC):</label>
              <input
                id="report-as-of-date"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg min-h-[36px]"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <AlertBanner
          type="error"
          title="Report Computation Notice"
          message={error}
          onRetry={loadReports}
        />
      )}

      {loading ? (
        <LoadingSkeleton variant="table" count={6} />
      ) : (
        <>
          {/* BALANCE SHEET REPORT */}
          {activeReport === "balance-sheet" && bsReport && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-card space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Balance Sheet Statement</h3>
                    <p className="text-xs text-slate-500">As of {bsReport.asOfDate} (UTC) &bull; Base Currency: {currency}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${bsReport.isBalanced ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
                    {bsReport.isBalanced ? "Assets = Liabilities + Equity" : "Out of Balance"}
                  </span>
                </div>

                {/* Assets Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#15616D]">1. Assets</h4>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {bsReport.assetAccounts.map((a) => (
                        <tr key={a.accountId} className="border-b border-slate-100 py-2">
                          <td className="py-2 text-slate-700 font-medium">
                            <span className="font-mono text-xs text-slate-500 mr-2">{a.accountCode}</span>
                            {a.accountName}
                          </td>
                          <td className="py-2 text-right font-mono tnum">
                            <CurrencyAmount amountMinorUnits={a.netBalanceMinorUnits} currency={currency} />
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold text-slate-900 bg-slate-50">
                        <td className="py-2.5 px-2">Total Assets:</td>
                        <td className="py-2.5 px-2 text-right font-mono tnum">
                          <CurrencyAmount amountMinorUnits={bsReport.totalAssetsMinorUnits} currency={currency} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Liabilities Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#FF7D00]">2. Liabilities</h4>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {bsReport.liabilityAccounts.map((a) => (
                        <tr key={a.accountId} className="border-b border-slate-100 py-2">
                          <td className="py-2 text-slate-700 font-medium">
                            <span className="font-mono text-xs text-slate-500 mr-2">{a.accountCode}</span>
                            {a.accountName}
                          </td>
                          <td className="py-2 text-right font-mono tnum">
                            <CurrencyAmount amountMinorUnits={a.netBalanceMinorUnits} currency={currency} />
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold text-slate-900 bg-slate-50">
                        <td className="py-2.5 px-2">Total Liabilities:</td>
                        <td className="py-2.5 px-2 text-right font-mono tnum">
                          <CurrencyAmount amountMinorUnits={bsReport.totalLiabilitiesMinorUnits} currency={currency} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Equity Section */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-purple-700">3. Equity</h4>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {bsReport.equityAccounts.map((a) => (
                        <tr key={a.accountId} className="border-b border-slate-100 py-2">
                          <td className="py-2 text-slate-700 font-medium">
                            <span className="font-mono text-xs text-slate-500 mr-2">{a.accountCode}</span>
                            {a.accountName}
                          </td>
                          <td className="py-2 text-right font-mono tnum">
                            <CurrencyAmount amountMinorUnits={a.netBalanceMinorUnits} currency={currency} />
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold text-slate-900 bg-slate-50">
                        <td className="py-2.5 px-2">Total Equity:</td>
                        <td className="py-2.5 px-2 text-right font-mono tnum">
                          <CurrencyAmount amountMinorUnits={bsReport.totalEquityMinorUnits} currency={currency} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* INCOME STATEMENT REPORT */}
          {activeReport === "income-statement" && isReport && (
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-card space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Income Statement (Profit & Loss)</h3>
                  <p className="text-xs text-slate-500">Period: {isReport.startDate} to {isReport.endDate} &bull; Currency: {currency}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-semibold block">Net Income</span>
                  <div className="text-xl font-bold font-mono">
                    <CurrencyAmount amountMinorUnits={isReport.netIncomeMinorUnits} currency={currency} highlightDirection />
                  </div>
                </div>
              </div>

              {/* Revenue Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Revenue</h4>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {isReport.revenueAccounts.map((r) => (
                      <tr key={r.accountId} className="border-b border-slate-100 py-2">
                        <td className="py-2 text-slate-700 font-medium">
                          <span className="font-mono text-xs text-slate-500 mr-2">{r.accountCode}</span>
                          {r.accountName}
                        </td>
                        <td className="py-2 text-right font-mono tnum">
                          <CurrencyAmount amountMinorUnits={r.netBalanceMinorUnits} currency={currency} />
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold text-slate-900 bg-slate-50">
                      <td className="py-2.5 px-2">Total Revenue:</td>
                      <td className="py-2.5 px-2 text-right font-mono tnum">
                        <CurrencyAmount amountMinorUnits={isReport.totalRevenueMinorUnits} currency={currency} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Expenses Section */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-rose-800 uppercase tracking-wider">Operating Expenses</h4>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {isReport.expenseAccounts.map((e) => (
                      <tr key={e.accountId} className="border-b border-slate-100 py-2">
                        <td className="py-2 text-slate-700 font-medium">
                          <span className="font-mono text-xs text-slate-500 mr-2">{e.accountCode}</span>
                          {e.accountName}
                        </td>
                        <td className="py-2 text-right font-mono tnum">
                          <CurrencyAmount amountMinorUnits={e.netBalanceMinorUnits} currency={currency} />
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold text-slate-900 bg-slate-50">
                      <td className="py-2.5 px-2">Total Expenses:</td>
                      <td className="py-2.5 px-2 text-right font-mono tnum">
                        <CurrencyAmount amountMinorUnits={isReport.totalExpensesMinorUnits} currency={currency} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TRIAL BALANCE REPORT */}
          {activeReport === "trial-balance" && tbReport && (
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Trial Balance Verification</h3>
                  <p className="text-xs text-slate-500">As of {tbReport.asOfDate} &bull; Currency: {currency}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tbReport.isBalanced ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
                  {tbReport.isBalanced ? "Balanced: Debits = Credits" : "Out of Balance"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 font-bold uppercase">
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Account Name</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Debit Balance</th>
                      <th className="px-3 py-2 text-right">Credit Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tbReport.accounts.map((a) => (
                      <tr key={a.accountId} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs font-bold text-slate-900">{a.accountCode}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{a.accountName}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{a.accountType}</td>
                        <td className="px-3 py-2 text-right font-mono tnum">
                          {a.debitAmountMinorUnits > 0 ? (
                            <CurrencyAmount amountMinorUnits={a.debitAmountMinorUnits} currency={currency} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tnum">
                          {a.creditAmountMinorUnits > 0 ? (
                            <CurrencyAmount amountMinorUnits={a.creditAmountMinorUnits} currency={currency} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900 text-sm">
                      <td colSpan={3} className="px-3 py-3 text-right uppercase">Verification Total:</td>
                      <td className="px-3 py-3 text-right font-mono tnum">
                        <CurrencyAmount amountMinorUnits={tbReport.totalDebitsMinorUnits} currency={currency} />
                      </td>
                      <td className="px-3 py-3 text-right font-mono tnum">
                        <CurrencyAmount amountMinorUnits={tbReport.totalCreditsMinorUnits} currency={currency} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
