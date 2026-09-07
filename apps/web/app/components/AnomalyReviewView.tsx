"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Anomaly, fetchAnomalies } from "../../lib/api-client";

interface AnomalyReviewViewProps {
  organizationId: string;
}

export const AnomalyReviewView: React.FC<AnomalyReviewViewProps> = ({ organizationId }) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnomalies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAnomalies(organizationId);
      setAnomalies(data);
    } catch (err: any) {
      setError(err.message || "Failed to scan accounting anomalies.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadAnomalies();
    }
  }, [organizationId]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Anomaly Review Queue</h2>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {anomalies.length} Flagged
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            AI-powered rule scanner analyzing duplicate reference codes, high-value outliers, and unmapped payees.
          </p>
        </div>
        <button
          onClick={loadAnomalies}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
        >
          <span>{loading ? "Scanning..." : "Run Anomaly Scan"}</span>
        </button>
      </div>

      {/* Anomalies Queue List */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-500 text-xs font-medium">
          Scanning general ledger and staged transactions for anomalies...
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadAnomalies} className="underline hover:text-red-900 font-bold">
            Retry Scan
          </button>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold text-lg mb-2">
            ✓
          </div>
          <p className="text-slate-900 text-sm font-bold">No Accounting Anomalies Detected</p>
          <p className="text-slate-500 text-xs mt-1">
            All posted journal entries and staged transactions passed duplicate, outlier, and mapping scans cleanly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalies.map((anom) => (
            <div
              key={anom.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                      anom.severity === "HIGH"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : anom.severity === "MEDIUM"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {anom.severity} SEVERITY
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {anom.id}</span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {anom.type.replace(/_/g, " ")}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{anom.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{anom.description}</p>
                <div className="pt-1 flex items-center space-x-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Suggested Action:
                  </span>
                  <span>{anom.suggestedAction}</span>
                </div>
              </div>

              {/* Confidence Score Gauge */}
              <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-medium">Detector Confidence</div>
                  <div className="text-sm font-bold text-slate-900 tnum">
                    {(anom.confidenceScore * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${anom.confidenceScore * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
