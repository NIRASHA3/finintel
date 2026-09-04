"use client";

import React, { useState, useEffect } from "react";
import {
  fetchTrialBalance,
  fetchIncomeStatement,
  fetchBalanceSheet,
  TrialBalanceReport,
  IncomeStatementReport,
  BalanceSheetReport,
  Organization,
} from "../../lib/api-client";

interface FinancialReportsViewProps {
  organization: Organization;
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({ organization }) => {
  const [activeReport, setActiveReport] = useState<"balance-sheet" | "income-statement" | "trial-balance">("balance-sheet");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const [tbReport, setTbReport] = useState<TrialBalanceReport | null>(null);
  const [isReport, setIsReport] = useState<IncomeStatementReport | null>(null);
  const [bsReport, setBsReport] = useState<BalanceSheetReport | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (minorUnits: number) => {
    const val = (minorUnits || 0) / 100;
    return val.toLocaleString("en-US", {
      style: "currency",
      currency: organization.baseCurrency || "USD",
      minimumFractionDigits: 2,
    });
  };

  const loadReports = async () => {
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
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load financial report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [organization.id, activeReport, asOfDate, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header & Report Selection Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveReport("balance-sheet")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeReport === "balance-sheet"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Balance Sheet
          </button>
          <button
            onClick={() => setActiveReport("income-statement")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeReport === "income-statement"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Income Statement (P&L)
          </button>
          <button
            onClick={() => setActiveReport("trial-balance")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeReport === "trial-balance"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Trial Balance
          </button>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-3">
          {activeReport === "income-statement" ? (
            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
              <span>As of Date:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <button
            onClick={loadReports}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs font-medium animate-pulse rounded-2xl bg-white border border-slate-200 shadow-sm">
          Generating financial statements...
        </div>
      ) : (
        <>
          {/* BALANCE SHEET REPORT */}
          {activeReport === "balance-sheet" && bsReport && (
            <div className="space-y-6">
              {/* BALANCE SHEET EQUATION SAFEGUARD BANNER */}
              <div
                className={`p-6 rounded-2xl border shadow-sm ${
                  bsReport.isBalanced
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : "bg-rose-50/80 border-rose-200 text-rose-950"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl text-xl font-black ${bsReport.isBalanced ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {bsReport.isBalanced ? "✓" : "⚠"}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold tracking-tight text-slate-900">
                        Balance Sheet Safeguard Status: {bsReport.isBalanced ? "ACCOUNTING EQUALITY ENFORCED" : "EQUATION UNBALANCED"}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">
                        Fundamental Safeguard: <span className="font-mono font-bold text-slate-900">Assets = Liabilities + Equity</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Assets</span>
                      <span className="text-sm font-bold text-emerald-700">{formatCurrency(bsReport.totalAssetsMinorUnits)}</span>
                    </div>
                    <div className="text-slate-400 font-bold text-base">=</div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Liabilities + Equity</span>
                      <span className="text-sm font-bold text-indigo-700">{formatCurrency(bsReport.totalLiabilitiesAndEquityMinorUnits)}</span>
                    </div>
                    {!bsReport.isBalanced && (
                      <div className="text-right pl-3 border-l border-rose-300">
                        <span className="text-rose-600 block text-[10px] uppercase font-bold">Delta</span>
                        <span className="text-sm font-bold text-rose-700">{formatCurrency(bsReport.equationDeltaMinorUnits)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3-Column Assets, Liabilities, Equity Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ASSETS */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Assets</h4>
                    <span className="text-sm font-mono font-bold text-emerald-700">{formatCurrency(bsReport.totalAssetsMinorUnits)}</span>
                  </div>

                  <div className="space-y-2">
                    {bsReport.assetAccounts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No asset account balances.</p>
                    ) : (
                      bsReport.assetAccounts.map((acc) => (
                        <div key={acc.accountId} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                          <div>
                            <span className="font-mono text-indigo-600 font-bold mr-2">{acc.accountCode}</span>
                            <span className="text-slate-900 font-medium">{acc.accountName}</span>
                          </div>
                          <span className="font-mono text-slate-900 font-semibold">{formatCurrency(acc.netBalanceMinorUnits)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* LIABILITIES */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Liabilities</h4>
                    <span className="text-sm font-mono font-bold text-amber-700">{formatCurrency(bsReport.totalLiabilitiesMinorUnits)}</span>
                  </div>

                  <div className="space-y-2">
                    {bsReport.liabilityAccounts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No liability account balances.</p>
                    ) : (
                      bsReport.liabilityAccounts.map((acc) => (
                        <div key={acc.accountId} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                          <div>
                            <span className="font-mono text-indigo-600 font-bold mr-2">{acc.accountCode}</span>
                            <span className="text-slate-900 font-medium">{acc.accountName}</span>
                          </div>
                          <span className="font-mono text-slate-900 font-semibold">{formatCurrency(acc.netBalanceMinorUnits)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* EQUITY */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Equity</h4>
                    <span className="text-sm font-mono font-bold text-indigo-700">{formatCurrency(bsReport.totalEquityMinorUnits)}</span>
                  </div>

                  <div className="space-y-2">
                    {bsReport.equityAccounts.map((acc) => (
                      <div key={acc.accountId} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                        <div>
                          <span className="font-mono text-indigo-600 font-bold mr-2">{acc.accountCode}</span>
                          <span className="text-slate-900 font-medium">{acc.accountName}</span>
                        </div>
                        <span className="font-mono text-slate-900 font-semibold">{formatCurrency(acc.netBalanceMinorUnits)}</span>
                      </div>
                    ))}

                    <div className="flex items-center justify-between text-xs py-2 bg-indigo-50 rounded-lg px-2.5 border border-indigo-200 font-bold mt-2">
                      <span className="text-indigo-900">Retained Earnings (Net Income)</span>
                      <span className="font-mono text-indigo-800">{formatCurrency(bsReport.retainedEarningsMinorUnits)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INCOME STATEMENT (P&L) REPORT */}
          {activeReport === "income-statement" && isReport && (
            <div className="space-y-6">
              {/* NET INCOME SUMMARY BANNER */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Income Statement (Profit & Loss)</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Reporting Period: <span className="text-slate-900 font-bold">{isReport.startDate}</span> to <span className="text-slate-900 font-bold">{isReport.endDate}</span>
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block font-semibold uppercase text-[10px]">Total Revenue</span>
                    <span className="text-base font-bold font-mono text-emerald-700">{formatCurrency(isReport.totalRevenueMinorUnits)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block font-semibold uppercase text-[10px]">Total Expenses</span>
                    <span className="text-base font-bold font-mono text-rose-700">{formatCurrency(isReport.totalExpensesMinorUnits)}</span>
                  </div>
                  <div className="text-right pl-6 border-l border-slate-200">
                    <span className="text-xs text-slate-500 block font-semibold uppercase text-[10px]">Net Income</span>
                    <span className={`text-xl font-black font-mono ${isReport.netIncomeMinorUnits >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatCurrency(isReport.netIncomeMinorUnits)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* REVENUE SECTION */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Revenues</h4>
                    <span className="text-sm font-mono font-bold text-emerald-700">{formatCurrency(isReport.totalRevenueMinorUnits)}</span>
                  </div>

                  <div className="space-y-2">
                    {isReport.revenueAccounts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No revenue recorded in period.</p>
                    ) : (
                      isReport.revenueAccounts.map((acc) => (
                        <div key={acc.accountId} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                          <div>
                            <span className="font-mono text-indigo-600 font-bold mr-2">{acc.accountCode}</span>
                            <span className="text-slate-900 font-medium">{acc.accountName}</span>
                          </div>
                          <span className="font-mono text-emerald-700 font-semibold">{formatCurrency(acc.netBalanceMinorUnits)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* EXPENSES SECTION */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider">Expenses</h4>
                    <span className="text-sm font-mono font-bold text-rose-700">{formatCurrency(isReport.totalExpensesMinorUnits)}</span>
                  </div>

                  <div className="space-y-2">
                    {isReport.expenseAccounts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No expenses recorded in period.</p>
                    ) : (
                      isReport.expenseAccounts.map((acc) => (
                        <div key={acc.accountId} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                          <div>
                            <span className="font-mono text-indigo-600 font-bold mr-2">{acc.accountCode}</span>
                            <span className="text-slate-900 font-medium">{acc.accountName}</span>
                          </div>
                          <span className="font-mono text-rose-700 font-semibold">{formatCurrency(acc.netBalanceMinorUnits)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TRIAL BALANCE REPORT */}
          {activeReport === "trial-balance" && tbReport && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Trial Balance Report</h3>
                  <p className="text-xs text-slate-500">As of {tbReport.asOfDate}</p>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className="text-slate-600">Total Debits: <strong className="text-slate-900">{formatCurrency(tbReport.totalDebitsMinorUnits)}</strong></span>
                  <span className="text-slate-600">Total Credits: <strong className="text-slate-900">{formatCurrency(tbReport.totalCreditsMinorUnits)}</strong></span>
                  <span className={`px-3 py-1 rounded-full font-sans font-bold text-[11px] border ${tbReport.isBalanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                    {tbReport.isBalanced ? "BALANCED" : "UNBALANCED"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-800">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Code</th>
                      <th className="p-3.5">Account Name</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5 text-right">Debit Balance</th>
                      <th className="p-3.5 text-right">Credit Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {tbReport.accounts.map((acc) => (
                      <tr key={acc.accountId} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-bold text-indigo-600">{acc.accountCode}</td>
                        <td className="p-3.5 font-sans font-medium text-slate-900">{acc.accountName}</td>
                        <td className="p-3.5 font-sans">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {acc.accountType}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-slate-900">{acc.debitAmountMinorUnits > 0 ? formatCurrency(acc.debitAmountMinorUnits) : "-"}</td>
                        <td className="p-3.5 text-right font-semibold text-slate-900">{acc.creditAmountMinorUnits > 0 ? formatCurrency(acc.creditAmountMinorUnits) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-mono font-bold text-slate-900 border-t border-slate-300">
                    <tr>
                      <td colSpan={3} className="p-3.5 font-sans text-right uppercase">Totals:</td>
                      <td className="p-3.5 text-right text-emerald-700">{formatCurrency(tbReport.totalDebitsMinorUnits)}</td>
                      <td className="p-3.5 text-right text-emerald-700">{formatCurrency(tbReport.totalCreditsMinorUnits)}</td>
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
