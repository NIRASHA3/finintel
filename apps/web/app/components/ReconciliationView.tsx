"use client";

import React, { useState } from "react";
import { autoMatchReconciliation, ReconciliationMatch } from "../../lib/api-client";

interface ReconciliationViewProps {
  organizationId: string;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({ organizationId }) => {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<ReconciliationMatch[]>([
    {
      id: "rec-1",
      bankTransactionId: "bt-2001",
      bankDate: "2026-09-02",
      bankAmountMinorUnits: 1500000,
      bankReference: "INV-8821",
      matchedEntry: {
        entryId: "je-901",
        entryNumber: 104,
        transactionDate: "2026-09-02",
        description: "Customer Invoice INV-8821 Payment",
        amountMinorUnits: 1500000,
      },
      confidenceScore: 1.0,
      matchStatus: "EXACT_MATCH",
    },
    {
      id: "rec-2",
      bankTransactionId: "bt-2002",
      bankDate: "2026-09-04",
      bankAmountMinorUnits: 45000,
      bankReference: "AWS-CLOUD-ACC-99",
      matchedEntry: {
        entryId: "je-905",
        entryNumber: 108,
        transactionDate: "2026-09-03",
        description: "Monthly AWS Infrastructure Hosting",
        amountMinorUnits: 45000,
      },
      confidenceScore: 0.85,
      matchStatus: "HIGH_CONFIDENCE",
    },
    {
      id: "rec-3",
      bankTransactionId: "bt-2003",
      bankDate: "2026-09-05",
      bankAmountMinorUnits: 125000,
      bankReference: "OFFICE-DEPOT-SUPPLIES",
      confidenceScore: 0.0,
      matchStatus: "UNMATCHED",
      discrepancyReason: "No matching posted journal entry found within 7-day date window",
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  const handleRunAutoMatch = async () => {
    try {
      setLoading(true);
      setError(null);
      const sampleBankTxs = [
        { id: "bt-3001", transaction_date: "2026-09-01", amount_minor_units: 1500000, reference: "INV-8821", description: "Wire Transfer In" },
        { id: "bt-3002", transaction_date: "2026-09-03", amount_minor_units: 45000, reference: "AWS-HOSTING", description: "Card Payment AWS" },
        { id: "bt-3003", transaction_date: "2026-09-06", amount_minor_units: 92000, reference: "REF-9912", description: "Unmatched Payment" },
      ];
      const res = await autoMatchReconciliation(organizationId, sampleBankTxs);
      if (res && res.length > 0) {
        setMatches(res);
      }
    } catch (err: any) {
      setError(err.message || "Failed to run bank reconciliation auto-match.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EXACT_MATCH":
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold">100% Exact Match</span>;
      case "HIGH_CONFIDENCE":
        return <span className="bg-teal-100 text-teal-800 text-xs px-2.5 py-1 rounded-full font-semibold">High Confidence</span>;
      case "SUGGESTED":
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold">Suggested</span>;
      default:
        return <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-semibold">Unmatched Discrepancy</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Automated Bank Reconciliation</h2>
          <p className="text-sm text-slate-500 mt-1">
            Rules-based auto-matching of imported bank statements against posted double-entry journal entries.
          </p>
        </div>
        <button
          onClick={handleRunAutoMatch}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Matching Entries..." : "Run Auto-Match Engine"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-sm">Reconciliation Matching Queue</h3>
          <span className="text-xs text-slate-500 font-medium">{matches.length} Bank Statements Evaluated</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-medium">
                <th className="py-3.5 px-4">Bank Ref & Date</th>
                <th className="py-3.5 px-4">Bank Amount</th>
                <th className="py-3.5 px-4">Matched Journal Entry</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {matches.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs">
                    <div className="font-semibold text-slate-900">{item.bankReference || item.bankTransactionId}</div>
                    <div className="text-slate-500">{item.bankDate}</div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    ${(item.bankAmountMinorUnits / 100).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    {item.matchedEntry ? (
                      <div>
                        <span className="font-semibold text-slate-900">JE #{item.matchedEntry.entryNumber}</span> - {item.matchedEntry.description}
                        <div className="text-xs text-slate-500 font-mono">{item.matchedEntry.transactionDate}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-xs">{item.discrepancyReason}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-xs">
                    {Math.round(item.confidenceScore * 100)}%
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(item.matchStatus)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => alert(`Resolved transaction ${item.id}`)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200 cursor-pointer"
                    >
                      {item.matchStatus === "UNMATCHED" ? "Manual Match" : "Confirm"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
