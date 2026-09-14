"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Anomaly, fetchAnomalies } from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  LoadingSkeleton,
  AlertBanner,
  EmptyState,
} from "./ui";

interface AnomalyReviewViewProps {
  organizationId?: string;
}

export const AnomalyReviewView: React.FC<AnomalyReviewViewProps> = ({
  organizationId: propOrgId,
}) => {
  const { activeOrg } = useOrganization();
  const organizationId = propOrgId || activeOrg?.id || "";
  const toast = useToast();

  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnomalies = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAnomalies(organizationId);
      setAnomalies(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to scan accounting anomalies.";
      setError(msg);
      toast.error(msg, "Scan Failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadAnomalies();
  }, [loadAnomalies]);

  const handleScan = async () => {
    await loadAnomalies();
    toast.success("AI anomaly scan completed.", "Scanner Finished");
  };

  if (!organizationId) {
    return (
      <EmptyState
        title="No active organization"
        description="Select an organization to review intelligence anomaly flags."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Intelligence Anomaly Queue</h2>
            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
              {anomalies.length} Flagged
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated intelligence rules analyzing duplicate references, outlier amounts, and unmapped entries.
          </p>
        </div>

        <button
          type="button"
          onClick={handleScan}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#FF7D00] hover:bg-[#E06E00] text-white text-sm font-bold shadow-sm transition disabled:opacity-50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
        >
          <span>{loading ? "Scanning..." : "Run Anomaly Scan"}</span>
        </button>
      </div>

      {error && (
        <AlertBanner
          type="error"
          title="Scan Notice"
          message={error}
          onRetry={loadAnomalies}
        />
      )}

      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : anomalies.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center font-bold text-xl mb-3 border border-emerald-200">
            ✓
          </div>
          <h3 className="text-base font-bold text-slate-900">No Accounting Anomalies Detected</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            All posted journal entries and staged transactions passed duplicate, outlier, and mapping scans cleanly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalies.map((anom) => (
            <div
              key={anom.id}
              className="p-5 rounded-xl bg-white border border-slate-200 shadow-card hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 max-w-3xl">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                      anom.severity === "HIGH"
                        ? "bg-rose-50 text-[#BA1A1A] border-rose-300"
                        : anom.severity === "MEDIUM"
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {anom.severity} Severity
                  </span>
                  <span className="text-xs font-mono text-slate-400 truncate">
                    Type: {anom.type} {anom.relatedEntityId ? `#${anom.relatedEntityId}` : ""}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 leading-snug">{anom.title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{anom.description}</p>
                {anom.suggestedAction && (
                  <p className="text-xs font-semibold text-[#15616D] bg-[#A8EAF8]/30 px-3 py-1.5 rounded-lg border border-[#15616D]/20 inline-block">
                    Suggested Action: {anom.suggestedAction}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  Confidence: {(anom.confidenceScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
