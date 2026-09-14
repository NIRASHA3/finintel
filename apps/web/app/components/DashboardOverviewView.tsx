"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  DashboardMetrics,
  fetchDashboardMetrics,
  downloadLedgerCSV,
  downloadAuditLogsCSV,
} from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  MetricCard,
  CurrencyAmount,
  LoadingSkeleton,
  AlertBanner,
  EmptyState,
} from "./ui";

interface DashboardOverviewViewProps {
  organizationId?: string;
}

export const DashboardOverviewView: React.FC<DashboardOverviewViewProps> = ({
  organizationId: propOrgId,
}) => {
  const { activeOrg } = useOrganization();
  const orgId = propOrgId || activeOrg?.id;
  const currency = activeOrg?.baseCurrency || "USD";

  const toast = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingLedger, setExportingLedger] = useState<boolean>(false);
  const [exportingAudit, setExportingAudit] = useState<boolean>(false);

  const loadMetrics = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardMetrics(orgId);
      setMetrics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load executive dashboard metrics.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleExportLedger = async () => {
    if (!orgId) return;
    try {
      setExportingLedger(true);
      await downloadLedgerCSV(orgId);
      toast.success("Ledger CSV export downloaded successfully.", "Export Complete");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export ledger CSV";
      toast.error(msg, "Export Failed");
    } finally {
      setExportingLedger(false);
    }
  };

  const handleExportAudit = async () => {
    if (!orgId) return;
    try {
      setExportingAudit(true);
      await downloadAuditLogsCSV(orgId);
      toast.success("Audit trail CSV export downloaded successfully.", "Export Complete");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export audit logs CSV";
      toast.error(msg, "Export Failed");
    } finally {
      setExportingAudit(false);
    }
  };

  if (!orgId) {
    return (
      <EmptyState
        title="No Active Workspace"
        description="Please select or onboard an organization to view executive metrics."
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="metric" count={4} />
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <AlertBanner
        type="error"
        title="Unable to compute financial metrics"
        message={error || "Could not retrieve ledger calculations."}
        onRetry={loadMetrics}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time financial position, liquidity runway, and burn rate metrics computed from posted ledger units.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportLedger}
            disabled={exportingLedger}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-2xs disabled:opacity-50 transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#15616D]"
          >
            {exportingLedger ? "Exporting..." : "Export Ledger CSV"}
          </button>
          <button
            type="button"
            onClick={handleExportAudit}
            disabled={exportingAudit}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-2xs disabled:opacity-50 transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#15616D]"
          >
            {exportingAudit ? "Exporting..." : "Export Audit CSV"}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated Runway */}
        <MetricCard
          title="Estimated Runway"
          value={`${metrics.runwayMonths > 90 ? "99.9+" : metrics.runwayMonths.toFixed(1)} Months`}
          periodDescription={`Trailing burn: ${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(metrics.monthlyBurnRateMinorUnits / 100)} / mo`}
          statusBadge={
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {metrics.runwayMonths >= 12 ? "Healthy" : "Watch"}
            </span>
          }
        />

        {/* Working Capital */}
        <MetricCard
          title="Working Capital"
          amountMinorUnits={metrics.workingCapitalMinorUnits}
          currency={currency}
          highlightDirection
          periodDescription="Current Assets minus Current Liabilities"
        />

        {/* Liquid Cash Position */}
        <MetricCard
          title="Liquid Cash Position"
          amountMinorUnits={metrics.cashPositionMinorUnits}
          currency={currency}
          periodDescription="Bank accounts and liquid cash reserves"
        />

        {/* YTD Net Income */}
        <MetricCard
          title="YTD Net Income"
          amountMinorUnits={metrics.netIncomeMinorUnits}
          currency={currency}
          highlightDirection
          periodDescription={`Revenue: ${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(metrics.ytdRevenueMinorUnits / 100)}`}
        />
      </div>

      {/* Expense Category Breakdown Section */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-card">
        <h3 className="text-base font-bold text-slate-900 mb-1">Operating Expense Breakdown</h3>
        <p className="text-sm text-slate-500 mb-6">Distribution of operating expenses across posted General Ledger accounts.</p>

        {metrics.expenseBreakdown.length === 0 ? (
          <EmptyState
            title="No expense data"
            description="No posted operating expense transactions recorded yet."
          />
        ) : (
          <div className="space-y-4">
            {metrics.expenseBreakdown.map((item) => (
              <div key={item.accountCode} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                      {item.accountCode}
                    </span>
                    <span className="font-semibold text-slate-800">{item.accountName}</span>
                  </div>
                  <div className="flex items-center space-x-3 tnum">
                    <CurrencyAmount amountMinorUnits={item.amountMinor} currency={currency} />
                    <span className="text-slate-500 font-medium w-14 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#15616D] rounded-full transition-all duration-500"
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
