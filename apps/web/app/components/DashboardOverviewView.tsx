"use client";

import React, { useEffect, useState, useCallback } from "react";
import { DashboardMetrics, fetchDashboardMetrics, downloadLedgerCSV, downloadAuditLogsCSV } from "../../lib/api-client";

interface DashboardOverviewViewProps {
  organizationId: string;
}

export const DashboardOverviewView: React.FC<DashboardOverviewViewProps> = ({ organizationId }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingLedger, setExportingLedger] = useState<boolean>(false);
  const [exportingAudit, setExportingAudit] = useState<boolean>(false);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardMetrics(organizationId);
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || "Failed to load executive dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadMetrics();
    }
  }, [organizationId]);

  const formatUSD = (minorUnits: number) => {
    const val = minorUnits / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const handleExportLedger = async () => {
    try {
      setExportingLedger(true);
      await downloadLedgerCSV(organizationId);
    } catch (err: any) {
      alert(err.message || "Failed to export ledger CSV");
    } finally {
      setExportingLedger(false);
    }
  };

  const handleExportAudit = async () => {
    try {
      setExportingAudit(true);
      await downloadAuditLogsCSV(organizationId);
    } catch (err: any) {
      alert(err.message || "Failed to export audit logs CSV");
    } finally {
      setExportingAudit(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-500 text-xs font-medium">
        Computing executive financial KPIs...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold">
        {error || "Unable to compute financial metrics."}
        <button
          onClick={loadMetrics}
          className="ml-4 underline hover:text-red-900 font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Real-time financial position, liquidity runway, and burn rate metrics computed from posted minor units.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportLedger}
            disabled={exportingLedger}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            {exportingLedger ? "Exporting..." : "Export Ledger CSV"}
          </button>
          <button
            onClick={handleExportAudit}
            disabled={exportingAudit}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            {exportingAudit ? "Exporting..." : "Export Audit CSV"}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash Runway */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Runway</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {metrics.runwayMonths >= 12 ? "Strong" : "Watch"}
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight tnum">
              {metrics.runwayMonths > 90 ? "99.9+" : metrics.runwayMonths.toFixed(1)}{" "}
              <span className="text-sm font-semibold text-slate-500">Months</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Based on monthly burn rate of {formatUSD(metrics.monthlyBurnRateMinorUnits)}</p>
          </div>
        </div>

        {/* Working Capital */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Working Capital</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${metrics.workingCapitalMinorUnits >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${metrics.workingCapitalMinorUnits >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
              {metrics.workingCapitalMinorUnits >= 0 ? "Positive" : "Deficit"}
            </span>
          </div>
          <div>
            <div className={`text-2xl font-black tracking-tight tnum ${metrics.workingCapitalMinorUnits >= 0 ? "text-slate-900" : "text-red-600"}`}>
              {formatUSD(metrics.workingCapitalMinorUnits)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Current Assets minus Current Liabilities</p>
          </div>
        </div>

        {/* Cash Position */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Position</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Liquid
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight tnum">
              {formatUSD(metrics.cashPositionMinorUnits)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Liquid cash & operating bank account balances</p>
          </div>
        </div>

        {/* Net Income YTD */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">YTD Net Income</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${metrics.netIncomeMinorUnits >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${metrics.netIncomeMinorUnits >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
              {metrics.netIncomeMinorUnits >= 0 ? "Profitable" : "Loss"}
            </span>
          </div>
          <div>
            <div className={`text-2xl font-black tracking-tight tnum ${metrics.netIncomeMinorUnits >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatUSD(metrics.netIncomeMinorUnits)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Total Revenue {formatUSD(metrics.ytdRevenueMinorUnits)}</p>
          </div>
        </div>
      </div>

      {/* Expense Category Breakdown Section */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-1">Expense Breakdown by Category</h3>
        <p className="text-xs text-slate-500 mb-5">Distribution of operating expenses across posted General Ledger accounts.</p>

        {metrics.expenseBreakdown.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs font-medium border border-dashed border-slate-200 rounded-xl">
            No posted expense transactions recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {metrics.expenseBreakdown.map((item) => (
              <div key={item.accountCode} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{item.accountCode}</span>
                    <span className="font-semibold text-slate-800">{item.accountName}</span>
                  </div>
                  <div className="flex items-center space-x-3 tnum">
                    <span className="font-bold text-slate-900">{formatUSD(item.amountMinor)}</span>
                    <span className="text-slate-500 font-medium w-12 text-right">{item.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
