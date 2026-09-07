"use client";

import React, { useState, useEffect } from "react";
import { fetchFxRates, upsertFxRate, runFxRevaluation, FxRate, FxRevaluationResult } from "../../lib/api-client";

interface FxRevaluationViewProps {
  organizationId: string;
}

export const FxRevaluationView: React.FC<FxRevaluationViewProps> = ({ organizationId }) => {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revalResult, setRevalResult] = useState<FxRevaluationResult | null>(null);
  const [revalLoading, setRevalLoading] = useState(false);

  // New rate form state
  const [baseCurr, setBaseCurr] = useState("USD");
  const [targetCurr, setTargetCurr] = useState("EUR");
  const [newRate, setNewRate] = useState("0.92");

  const loadRates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFxRates(organizationId);
      setRates(data);
    } catch (err: any) {
      setError(err.message || "Failed to load FX exchange rates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, [organizationId]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await upsertFxRate(organizationId, baseCurr, targetCurr, parseFloat(newRate));
      await loadRates();
    } catch (err: any) {
      setError(err.message || "Failed to save exchange rate.");
    }
  };

  const handleRunRevaluation = async () => {
    try {
      setRevalLoading(true);
      setError(null);
      const res = await runFxRevaluation(organizationId, "USD", "EUR", 50000);
      setRevalResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to run unrealized FX gain/loss revaluation.");
    } finally {
      setRevalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Multi-Currency & FX Rate Table</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tenant-configurable exchange rates for deterministic period-end unrealized gain/loss revaluations.
          </p>
        </div>
        <button
          onClick={handleRunRevaluation}
          disabled={revalLoading}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {revalLoading ? "Calculating..." : "Run Period-End Revaluation"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {revalResult && (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-900 text-sm">Period-End Revaluation Executed</span>
            <span className="bg-emerald-200 text-emerald-900 text-xs px-2.5 py-0.5 rounded-full font-semibold">POSTED</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-emerald-900 pt-2">
            <div>
              <span className="block text-emerald-700 font-medium">Foreign Amount</span>
              <span className="font-bold text-sm">€{revalResult.original_foreign_amount.toLocaleString()} EUR</span>
            </div>
            <div>
              <span className="block text-emerald-700 font-medium">Booked Base Value</span>
              <span className="font-bold text-sm">${revalResult.booked_base_amount.toLocaleString()} USD</span>
            </div>
            <div>
              <span className="block text-emerald-700 font-medium">Revalued Base Value</span>
              <span className="font-bold text-sm">${revalResult.revalued_base_amount.toLocaleString()} USD</span>
            </div>
            <div>
              <span className="block text-emerald-700 font-medium">Unrealized Gain / Loss</span>
              <span className={`font-bold text-sm ${revalResult.unrealized_gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                ${revalResult.unrealized_gain_loss.toLocaleString()} USD
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Configured FX Exchange Rates</h3>
            <span className="text-xs text-slate-500 font-medium">{rates.length} Currency Pairs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-medium">
                  <th className="py-3.5 px-4">Base Currency</th>
                  <th className="py-3.5 px-4">Target Currency</th>
                  <th className="py-3.5 px-4">Exchange Rate</th>
                  <th className="py-3.5 px-4">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{rate.base_currency}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{rate.target_currency}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-700">{rate.rate}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-500">{rate.effective_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Update FX Exchange Rate</h3>
          <form onSubmit={handleSaveRate} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Base Currency</label>
              <input
                type="text"
                value={baseCurr}
                onChange={(e) => setBaseCurr(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Currency</label>
              <input
                type="text"
                value={targetCurr}
                onChange={(e) => setTargetCurr(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exchange Rate</label>
              <input
                type="number"
                step="0.0001"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Save Rate
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
