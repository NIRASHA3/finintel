"use client";

import React, { useState, useEffect } from "react";
import {
  fetchFiscalPeriods,
  generateFiscalPeriods,
  closeFiscalPeriod,
  lockFiscalPeriod,
  unlockFiscalPeriod,
  FiscalPeriod,
  Organization,
} from "../../lib/api-client";

interface FiscalPeriodsViewProps {
  organization: Organization;
}

export const FiscalPeriodsView: React.FC<FiscalPeriodsViewProps> = ({ organization }) => {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFiscalPeriods(organization.id);
      setPeriods(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load fiscal periods");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, [organization.id]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const freshPeriods = await generateFiscalPeriods(organization.id, selectedYear);
      setPeriods(freshPeriods);
      setSuccessMsg(`Successfully initialized 12 fiscal periods for year ${selectedYear}.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate fiscal periods");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (periodId: string, action: "close" | "lock" | "unlock") => {
    setActionLoadingId(periodId);
    setError(null);
    setSuccessMsg(null);
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
      setSuccessMsg(`Fiscal period status updated to ${updated.status}.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to ${action} fiscal period`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusBadge = (status: "OPEN" | "CLOSED" | "LOCKED") => {
    switch (status) {
      case "OPEN":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">OPEN</span>;
      case "CLOSED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">CLOSED</span>;
      case "LOCKED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">LOCKED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* SAFEGUARD BANNER */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Fiscal Period Closing & Lock Engine</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl font-medium">
              Protects historical accounting data integrity. Posting journal entries to a <strong className="text-amber-800">CLOSED</strong> or <strong className="text-rose-700">LOCKED</strong> period is rejected at the database transaction layer.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-xs"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>FY {yr}</option>
              ))}
            </select>

            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
            >
              Generate FY {selectedYear} Periods
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* FISCAL PERIODS TABLE */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs font-medium animate-pulse rounded-2xl bg-white border border-slate-200 shadow-sm">
          Loading fiscal periods...
        </div>
      ) : periods.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 shadow-sm">
          <p className="text-slate-900 text-sm font-bold">No fiscal periods initialized yet.</p>
          <p className="text-slate-500 text-xs mt-1">Click &quot;Generate FY {selectedYear} Periods&quot; above to set up 12 monthly accounting periods.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Period</th>
                <th className="p-3.5">Fiscal Year</th>
                <th className="p-3.5">Start Date</th>
                <th className="p-3.5">End Date</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="p-3.5 font-bold text-indigo-600">Period {p.periodNumber}</td>
                  <td className="p-3.5 font-sans font-medium text-slate-900">{p.fiscalYear}</td>
                  <td className="p-3.5 text-slate-600 font-medium">{p.startDate}</td>
                  <td className="p-3.5 text-slate-600 font-medium">{p.endDate}</td>
                  <td className="p-3.5 font-sans">{statusBadge(p.status)}</td>
                  <td className="p-3.5 text-right font-sans">
                    <div className="inline-flex items-center gap-2">
                      {p.status === "OPEN" && (
                        <button
                          disabled={actionLoadingId === p.id}
                          onClick={() => handleStatusChange(p.id, "close")}
                          className="px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-xs"
                        >
                          Close Period
                        </button>
                      )}
                      {p.status === "CLOSED" && (
                        <>
                          <button
                            disabled={actionLoadingId === p.id}
                            onClick={() => handleStatusChange(p.id, "lock")}
                            className="px-3 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs"
                          >
                            Lock Period
                          </button>
                          <button
                            disabled={actionLoadingId === p.id}
                            onClick={() => handleStatusChange(p.id, "unlock")}
                            className="px-3 py-1 text-xs font-semibold bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                          >
                            Re-Open
                          </button>
                        </>
                      )}
                      {p.status === "LOCKED" && (
                        <button
                          disabled={actionLoadingId === p.id}
                          onClick={() => handleStatusChange(p.id, "unlock")}
                          className="px-3 py-1 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
                        >
                          Unlock Period
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
