"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchFiscalPeriods,
  generateFiscalPeriods,
  closeFiscalPeriod,
  lockFiscalPeriod,
  unlockFiscalPeriod,
  FiscalPeriod,
  Organization,
} from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  StatusBadge,
  DataTable,
  ConfirmDialog,
  Column,
  EmptyState,
} from "./ui";

interface FiscalPeriodsViewProps {
  organization?: Organization;
}

export const FiscalPeriodsView: React.FC<FiscalPeriodsViewProps> = ({
  organization: propOrg,
}) => {
  const { activeOrg } = useOrganization();
  const organization = propOrg || activeOrg;
  const toast = useToast();

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Confirmation dialog for locking period
  const [periodToLock, setPeriodToLock] = useState<FiscalPeriod | null>(null);

  const loadPeriods = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const data = await fetchFiscalPeriods(organization.id);
      setPeriods(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load fiscal periods";
      toast.error(msg, "Data Load Failed");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, toast]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const handleGenerate = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const freshPeriods = await generateFiscalPeriods(organization.id, selectedYear);
      setPeriods(freshPeriods);
      toast.success(
        `Successfully initialized 12 fiscal periods for year ${selectedYear}.`,
        "Periods Initialized"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate fiscal periods";
      toast.error(msg, "Generation Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (periodId: string, action: "close" | "lock" | "unlock") => {
    if (!organization?.id) return;
    setActionLoadingId(periodId);
    try {
      let updated: FiscalPeriod;
      if (action === "close") {
        updated = await closeFiscalPeriod(organization.id, periodId);
      } else if (action === "lock") {
        updated = await lockFiscalPeriod(organization.id, periodId);
      } else {
        updated = await unlockFiscalPeriod(organization.id, periodId);
      }

      setPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? updated : p))
      );
      setPeriodToLock(null);
      toast.success(`Fiscal period status updated to ${updated.status}.`, "Period Status Changed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} fiscal period`;
      toast.error(msg, "Action Failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!organization) {
    return (
      <EmptyState
        title="No organization selected"
        description="Select an organization to manage accounting fiscal periods."
      />
    );
  }

  const columns: Column<FiscalPeriod>[] = [
    {
      key: "periodNumber",
      header: "Period",
      width: "100px",
      render: (p) => (
        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
          {p.fiscalYear}-P{String(p.periodNumber).padStart(2, "0")}
        </span>
      ),
    },
    {
      key: "startDate",
      header: "Start Date (UTC)",
      render: (p) => <span className="font-mono text-xs text-slate-700">{p.startDate}</span>,
    },
    {
      key: "endDate",
      header: "End Date (UTC)",
      render: (p) => <span className="font-mono text-xs text-slate-700">{p.endDate}</span>,
    },
    {
      key: "status",
      header: "Accounting Status",
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: "actions",
      header: "State Actions",
      align: "right",
      render: (p) => {
        const isBusy = actionLoadingId === p.id;
        return (
          <div className="flex items-center justify-end gap-2">
            {p.status === "OPEN" && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleStatusChange(p.id, "close")}
                className="px-3 py-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition min-h-[32px] disabled:opacity-50"
              >
                Close Period
              </button>
            )}

            {p.status === "CLOSED" && (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setPeriodToLock(p)}
                  className="px-3 py-1 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-lg transition min-h-[32px] disabled:opacity-50"
                >
                  Lock Period
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleStatusChange(p.id, "unlock")}
                  className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg transition min-h-[32px] disabled:opacity-50"
                >
                  Re-Open
                </button>
              </>
            )}

            {p.status === "LOCKED" && (
              <span className="text-xs font-bold text-slate-400">Locked Permanently</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Safeguard & Generation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Fiscal Periods & Hard-Lock Safeguards
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Committed and locked periods prevent retroactive transaction posting and guarantee audit immutability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="fiscal-year-select" className="sr-only">Fiscal Year</label>
          <select
            id="fiscal-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg min-h-[44px]"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>Year {y}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition min-h-[44px] disabled:opacity-50"
          >
            Generate 12 Periods
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={periods}
        keyExtractor={(p) => p.id}
        loading={loading}
        emptyTitle="No fiscal periods initialized"
        emptyDescription="Generate the 12 fiscal periods for the accounting calendar year above."
        emptyActionLabel="Generate 12 Fiscal Periods"
        onEmptyAction={handleGenerate}
      />

      {/* Lock Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(periodToLock)}
        onClose={() => setPeriodToLock(null)}
        onConfirm={() => {
          if (periodToLock) {
            handleStatusChange(periodToLock.id, "lock");
          }
        }}
        title={`Confirm Hard-Lock: Period ${periodToLock?.fiscalYear}-P${String(periodToLock?.periodNumber).padStart(2, "0")}`}
        message="Locking this fiscal period will permanently seal the ledger for this date range. No further entries or revisions can be posted into this period."
        confirmLabel="Hard-Lock Period"
        isDestructive={true}
        isLoading={Boolean(actionLoadingId)}
      />
    </div>
  );
};
