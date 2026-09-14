"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchFxRates, upsertFxRate, runFxRevaluation, FxRate, FxRevaluationResult } from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  CurrencyAmount,
  StatusBadge,
  AlertBanner,
  DataTable,
  Column,
} from "./ui";

interface FxRevaluationViewProps {
  organizationId?: string;
}

export const FxRevaluationView: React.FC<FxRevaluationViewProps> = ({
  organizationId: propOrgId,
}) => {
  const { activeOrg } = useOrganization();
  const organizationId = propOrgId || activeOrg?.id || "";
  const baseCurrency = activeOrg?.baseCurrency || "USD";
  const toast = useToast();

  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revalResult, setRevalResult] = useState<FxRevaluationResult | null>(null);
  const [revalLoading, setRevalLoading] = useState(false);

  // New rate form state
  const [baseCurr, setBaseCurr] = useState(baseCurrency);
  const [targetCurr, setTargetCurr] = useState("EUR");
  const [newRate, setNewRate] = useState("0.92");

  const loadRates = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFxRates(organizationId);
      setRates(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load FX exchange rates.";
      setError(msg);
      toast.error(msg, "FX Rates Error");
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    try {
      setError(null);
      await upsertFxRate(organizationId, baseCurr, targetCurr, parseFloat(newRate));
      toast.success(`Exchange rate ${baseCurr}/${targetCurr} updated to ${newRate}.`, "Rate Saved");
      await loadRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save exchange rate.";
      setError(msg);
      toast.error(msg, "Save Failed");
    }
  };

  const handleRunRevaluation = async () => {
    if (!organizationId) return;
    try {
      setRevalLoading(true);
      setError(null);
      const res = await runFxRevaluation(organizationId, baseCurrency, "EUR", 50000);
      setRevalResult(res);
      toast.success("Period-end FX revaluation simulated.", "Revaluation Computed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to run FX revaluation.";
      setError(msg);
      toast.error(msg, "Revaluation Failed");
    } finally {
      setRevalLoading(false);
    }
  };

  const columns: Column<FxRate>[] = [
    {
      key: "pair",
      header: "Currency Pair",
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
          {r.base_currency} / {r.target_currency}
        </span>
      ),
    },
    {
      key: "rate",
      header: "Exchange Rate",
      align: "right",
      isNumeric: true,
      render: (r) => (
        <span className="font-mono font-bold text-sm text-slate-900 tnum">
          {Number(r.rate).toFixed(4)}
        </span>
      ),
    },
    {
      key: "effective_date",
      header: "Effective Date (UTC)",
      render: (r) => <span className="font-mono text-xs text-slate-600">{r.effective_date}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      render: () => <StatusBadge status="ONLINE" label="Active Rate" size="sm" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Prototype Banner */}
      <div className="flex items-center justify-between p-4 bg-[#A8EAF8]/20 border border-[#15616D]/30 rounded-xl text-sm text-[#004E59]">
        <div className="flex items-center gap-2.5">
          <StatusBadge status="PROTOTYPE" label="DEMO / PROTOTYPE" size="sm" />
          <p className="font-medium">
            Multi-currency revaluation is operating in <strong>prototype mode</strong> with in-memory sample rate evaluation. Real-time rate feeder integrations will be introduced in a future track.
          </p>
        </div>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Multi-Currency & FX Rate Table</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Deterministic period-end unrealized foreign exchange gain/loss revaluation engine.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunRevaluation}
          disabled={revalLoading}
          className="inline-flex items-center justify-center px-4 py-2 bg-[#FF7D00] hover:bg-[#E06E00] text-white font-bold text-sm rounded-lg shadow-sm transition min-h-[44px] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
        >
          {revalLoading ? "Calculating..." : "Run Period-End Revaluation"}
        </button>
      </div>

      {error && (
        <AlertBanner
          type="error"
          title="FX Engine Notice"
          message={error}
          onRetry={loadRates}
        />
      )}

      {/* Simulated Revaluation Result */}
      {revalResult && (
        <div className="bg-emerald-50 border border-emerald-300 p-5 rounded-xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-950 text-sm">Simulated Period-End Revaluation Output</span>
            <StatusBadge status="POSTED" label="Simulated Entry Generated" size="sm" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-emerald-950 pt-1">
            <div>
              <span className="block text-emerald-700 font-semibold mb-0.5">Foreign Amount</span>
              <span className="font-bold font-mono text-sm tnum">€{revalResult.original_foreign_amount.toLocaleString()} EUR</span>
            </div>
            <div>
              <span className="block text-emerald-700 font-semibold mb-0.5">Booked Base Value</span>
              <span className="font-bold font-mono text-sm tnum">
                <CurrencyAmount amountMinorUnits={revalResult.booked_base_amount * 100} currency={baseCurrency} />
              </span>
            </div>
            <div>
              <span className="block text-emerald-700 font-semibold mb-0.5">Revalued Base Value</span>
              <span className="font-bold font-mono text-sm tnum">
                <CurrencyAmount amountMinorUnits={revalResult.revalued_base_amount * 100} currency={baseCurrency} />
              </span>
            </div>
            <div>
              <span className="block text-emerald-700 font-semibold mb-0.5">Unrealized Gain / Loss</span>
              <span className="font-bold font-mono text-sm tnum">
                <CurrencyAmount
                  amountMinorUnits={revalResult.unrealized_gain_loss * 100}
                  currency={baseCurrency}
                  showSign
                  highlightDirection
                />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Rate Form & Rate Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-card space-y-4">
          <h3 className="text-base font-bold text-slate-900">Define Exchange Rate</h3>
          <form onSubmit={handleSaveRate} className="space-y-3">
            <div>
              <label htmlFor="fx-base-curr" className="block text-xs font-bold text-slate-700 mb-1">
                Base Currency (ISO 4217)
              </label>
              <input
                id="fx-base-curr"
                type="text"
                value={baseCurr}
                onChange={(e) => setBaseCurr(e.target.value.toUpperCase())}
                required
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="fx-target-curr" className="block text-xs font-bold text-slate-700 mb-1">
                Target Foreign Currency
              </label>
              <input
                id="fx-target-curr"
                type="text"
                value={targetCurr}
                onChange={(e) => setTargetCurr(e.target.value.toUpperCase())}
                required
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="fx-rate-val" className="block text-xs font-bold text-slate-700 mb-1">
                Exchange Multiplier Rate
              </label>
              <input
                id="fx-rate-val"
                type="number"
                step="0.0001"
                min="0.0001"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                required
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-[#15616D] hover:bg-[#004E59] text-white font-bold text-xs rounded-lg transition min-h-[44px]"
            >
              Save Exchange Rate
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="lg:col-span-2">
          <DataTable
            columns={columns}
            data={rates}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle="No exchange rates saved"
            emptyDescription="Define currency exchange rates on the left to support foreign transaction revaluation."
          />
        </div>
      </div>
    </div>
  );
};
