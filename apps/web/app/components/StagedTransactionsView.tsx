"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchStagedTransactions,
  uploadCSVStagedTransactions,
  approveStagedTransaction,
  rejectStagedTransaction,
  batchPostStagedTransactions,
  fetchAccounts,
  StagedTransaction,
  Account,
  BatchPostResult,
} from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  CurrencyAmount,
  StatusBadge,
  DataTable,
  ConfirmDialog,
  Column,
} from "./ui";

interface Props {
  organizationId?: string;
}

export function StagedTransactionsView({ organizationId: propOrgId }: Props) {
  const { activeOrg } = useOrganization();
  const organizationId = propOrgId || activeOrg?.id || "";
  const currency = activeOrg?.baseCurrency || "USD";
  const toast = useToast();

  const [stagedItems, setStagedItems] = useState<StagedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [overrideAccounts, setOverrideAccounts] = useState<Record<string, string>>({});
  const [showBatchConfirm, setShowBatchConfirm] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [sData, aData] = await Promise.all([
        fetchStagedTransactions(organizationId),
        fetchAccounts(organizationId),
      ]);
      setStagedItems(sData);
      setAccounts(aData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load staged transactions";
      setError(msg);
      toast.error(msg, "Data Load Failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const res = await uploadCSVStagedTransactions(organizationId, file);
      toast.success(
        `${res.insertedCount} new transactions staged for review.`,
        "CSV Uploaded Successfully"
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload CSV";
      setError(msg);
      toast.error(msg, "Upload Failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleGenerateSampleCSV = async () => {
    setIsUploading(true);
    setError(null);

    const sampleCSV = `Transaction Date,Payee / Description,Amount,Reference Number
2026-03-01,AWS Cloud Infrastructure Services,-450.00,AWS-994821
2026-03-02,Stripe Client Revenue Payment,3250.00,STRIPE-88123
2026-03-03,Google Workspace Enterprise Subscription,-120.00,GSuite-33211
2026-03-04,WeWork Office Space Lease,-1800.00,WEWORK-9901
2026-03-05,Client Invoice #1042 Direct Deposit,5000.00,INV-1042`;

    try {
      const res = await uploadCSVStagedTransactions(organizationId, sampleCSV);
      toast.success(
        `${res.insertedCount} sample transactions staged.`,
        "Sample Data Staged"
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate sample CSV";
      setError(msg);
      toast.error(msg, "Generation Failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleApprove = async (item: StagedTransaction) => {
    const targetAccountId = overrideAccounts[item.id] || item.suggestedAccountId;
    try {
      const updated = await approveStagedTransaction(organizationId, item.id, targetAccountId);
      setStagedItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...updated, status: "APPROVED" } : i))
      );
      toast.success(`Transaction approved for batch posting.`, "Approved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve transaction";
      toast.error(msg, "Approval Failed");
    }
  };

  const handleReject = async (item: StagedTransaction) => {
    try {
      const updated = await rejectStagedTransaction(organizationId, item.id);
      setStagedItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...updated, status: "REJECTED" } : i))
      );
      toast.info(`Transaction marked as rejected.`, "Rejected");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject transaction";
      toast.error(msg, "Rejection Failed");
    }
  };

  const handleExecuteBatchPost = async () => {
    const approvedCount = stagedItems.filter((i) => i.status === "APPROVED").length;
    if (approvedCount === 0) {
      toast.warning("No APPROVED transactions available for batch posting.", "Notice");
      setShowBatchConfirm(false);
      return;
    }

    setIsPosting(true);
    try {
      const result: BatchPostResult = await batchPostStagedTransactions(organizationId);
      toast.success(
        `${result.postedEntriesCount} journal entries created in General Ledger.`,
        "Batch Post Successful"
      );
      setShowBatchConfirm(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute batch posting";
      toast.error(msg, "Batch Post Failed");
    } finally {
      setIsPosting(false);
    }
  };

  const approvedCount = stagedItems.filter((i) => i.status === "APPROVED").length;
  const filteredItems = stagedItems.filter((item) => {
    if (statusFilter === "ALL") return true;
    return item.status === statusFilter;
  });

  const columns: Column<StagedTransaction>[] = [
    {
      key: "transactionDate",
      header: "Date (UTC)",
      render: (item) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {item.transactionDate}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description / Raw Digest",
      render: (item) => (
        <div className="space-y-0.5 max-w-xs sm:max-w-md">
          <p className="font-semibold text-slate-900 truncate">{item.description}</p>
          <p className="font-mono text-xs text-slate-400 truncate">
            SHA: {item.rawDataHash.substring(0, 16)}...
          </p>
        </div>
      ),
    },
    {
      key: "amountMinorUnits",
      header: "Amount",
      align: "right",
      isNumeric: true,
      render: (item) => (
        <CurrencyAmount
          amountMinorUnits={item.amountMinorUnits}
          currency={currency}
          showSign
          highlightDirection
        />
      ),
    },
    {
      key: "suggestedAccount",
      header: "COA Account Category",
      render: (item) => {
        if (item.status === "POSTED" || item.status === "REJECTED") {
          return (
            <span className="text-xs font-semibold text-slate-700">
              {item.suggestedAccountCode ? `${item.suggestedAccountCode} - ` : ""}
              {item.suggestedAccountName || "Uncategorized"}
            </span>
          );
        }

        const selectedVal = overrideAccounts[item.id] || item.suggestedAccountId || "";
        return (
          <select
            value={selectedVal}
            onChange={(e) =>
              setOverrideAccounts((prev) => ({
                ...prev,
                [item.id]: e.target.value,
              }))
            }
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-[#15616D] max-w-[200px]"
            aria-label={`Select account for ${item.description}`}
          >
            <option value="">-- Assign Account --</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountCode} - {acc.name} ({acc.accountType})
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "status",
      header: "Review Status",
      render: (item) => <StatusBadge status={item.status} size="sm" />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (item) => {
        if (item.status === "POSTED") {
          return <span className="text-xs font-semibold text-slate-400">Locked / Posted</span>;
        }

        return (
          <div className="flex items-center justify-end gap-1.5">
            {item.status !== "APPROVED" && (
              <button
                type="button"
                onClick={() => handleApprove(item)}
                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition min-h-[32px] focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Approve
              </button>
            )}
            {item.status !== "REJECTED" && (
              <button
                type="button"
                onClick={() => handleReject(item)}
                className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-lg transition min-h-[32px] focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Reject
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Transaction Import & Staging Queue
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated SHA-256 deduplication, rule-matching suggestions, and batch ledger posting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleGenerateSampleCSV}
            disabled={isUploading}
            className="inline-flex items-center justify-center px-3.5 py-2 text-sm font-bold text-[#15616D] bg-[#A8EAF8]/30 border border-[#15616D]/30 hover:bg-[#A8EAF8]/50 rounded-lg transition disabled:opacity-50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#15616D]"
          >
            {isUploading ? "Processing..." : "Generate Sample CSV"}
          </button>

          <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg transition min-h-[44px] focus-within:ring-2 focus-within:ring-[#15616D]">
            <span>Upload Bank CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="sr-only"
              disabled={isUploading}
            />
          </label>

          <button
            type="button"
            onClick={() => setShowBatchConfirm(true)}
            disabled={approvedCount === 0 || isPosting}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition disabled:opacity-40 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
          >
            {isPosting ? "Posting..." : `Batch Post Approved (${approvedCount})`}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-semibold">
        {(["ALL", "PENDING", "APPROVED", "REJECTED", "POSTED"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg transition min-h-[36px] ${
              statusFilter === tab
                ? "bg-[#001524] text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyTitle="No staged transactions"
        emptyDescription="Upload a bank statement CSV or generate sample data to populate the queue."
        emptyActionLabel="Generate Sample CSV"
        onEmptyAction={handleGenerateSampleCSV}
      />

      {/* Batch Posting Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showBatchConfirm}
        onClose={() => setShowBatchConfirm(false)}
        onConfirm={handleExecuteBatchPost}
        title="Confirm Batch Posting to General Ledger"
        message={`Are you sure you want to post ${approvedCount} approved transactions into the immutable General Ledger? Each will generate a double-entry balanced journal entry.`}
        confirmLabel={`Post ${approvedCount} Transactions`}
        isDestructive={false}
        isLoading={isPosting}
      />
    </div>
  );
}
