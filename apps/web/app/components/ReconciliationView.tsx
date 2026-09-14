"use client";

import React, { useState } from "react";
import { autoMatchReconciliation, ReconciliationMatch } from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  CurrencyAmount,
  StatusBadge,
  AlertBanner,
  DataTable,
  Column,
} from "./ui";

interface ReconciliationViewProps {
  organizationId?: string;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  organizationId: propOrgId,
}) => {
  const { activeOrg } = useOrganization();
  const organizationId = propOrgId || activeOrg?.id || "";
  const currency = activeOrg?.baseCurrency || "USD";
  const toast = useToast();

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
    if (!organizationId) return;
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
        toast.success(`Matched ${res.length} sample bank transactions.`, "Auto-Match Succeeded");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to run bank reconciliation auto-match.";
      setError(msg);
      toast.error(msg, "Auto-Match Error");
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<ReconciliationMatch>[] = [
    {
      key: "bankDate",
      header: "Bank Date (UTC)",
      render: (m) => <span className="font-mono text-xs font-semibold">{m.bankDate}</span>,
    },
    {
      key: "bankReference",
      header: "Statement Reference",
      render: (m) => (
        <div>
          <p className="font-semibold text-slate-900">{m.bankReference}</p>
          <span className="text-xs text-slate-400 font-mono">ID: {m.bankTransactionId}</span>
        </div>
      ),
    },
    {
      key: "bankAmountMinorUnits",
      header: "Bank Amount",
      align: "right",
      isNumeric: true,
      render: (m) => (
        <CurrencyAmount amountMinorUnits={m.bankAmountMinorUnits} currency={currency} />
      ),
    },
    {
      key: "matchedEntry",
      header: "Matched General Ledger Entry",
      render: (m) =>
        m.matchedEntry ? (
          <div>
            <span className="text-xs font-bold text-[#15616D] bg-[#A8EAF8]/30 px-2 py-0.5 rounded border border-[#15616D]/20 mr-2">
              Entry #{m.matchedEntry.entryNumber}
            </span>
            <span className="text-xs text-slate-700">{m.matchedEntry.description}</span>
          </div>
        ) : (
          <span className="text-xs text-rose-700 font-medium">
            {m.discrepancyReason || "No match found"}
          </span>
        ),
    },
    {
      key: "matchStatus",
      header: "Match Quality",
      render: (m) => {
        switch (m.matchStatus) {
          case "EXACT_MATCH":
            return <StatusBadge status="APPROVED" label="100% Exact Match" size="sm" />;
          case "HIGH_CONFIDENCE":
            return <StatusBadge status="PENDING" label="High Confidence" size="sm" />;
          case "SUGGESTED":
            return <StatusBadge status="PENDING" label="Suggested" size="sm" />;
          default:
            return <StatusBadge status="REJECTED" label="Unmatched Discrepancy" size="sm" />;
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Prototype Disclaimer Banner */}
      <div className="flex items-center justify-between p-4 bg-[#A8EAF8]/20 border border-[#15616D]/30 rounded-xl text-sm text-[#004E59]">
        <div className="flex items-center gap-2.5">
          <StatusBadge status="PROTOTYPE" label="DEMO / PROTOTYPE" size="sm" />
          <p className="font-medium">
            Bank statement reconciliation is currently operating in <strong>prototype mode</strong> with simulated rules matching. Persistent banking integrations will be connected in a future release.
          </p>
        </div>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Bank Reconciliation Auto-Matcher
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Rules-based matching of imported statement records against posted double-entry journals.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAutoMatch}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2 bg-[#FF7D00] hover:bg-[#E06E00] text-white text-sm font-bold rounded-lg shadow-sm transition min-h-[44px] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
        >
          {loading ? "Matching Statements..." : "Run Statement Auto-Match"}
        </button>
      </div>

      {error && (
        <AlertBanner
          type="error"
          title="Reconciliation Error"
          message={error}
          onRetry={handleRunAutoMatch}
        />
      )}

      {/* Matches Table */}
      <DataTable
        columns={columns}
        data={matches}
        keyExtractor={(m) => m.id}
        loading={loading}
        emptyTitle="No statement records"
        emptyDescription="Run auto-match to inspect reconciliation records."
      />
    </div>
  );
};
