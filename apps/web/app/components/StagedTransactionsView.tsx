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

interface Props {
  organizationId: string;
}

export function StagedTransactionsView({ organizationId }: Props) {
  const [stagedItems, setStagedItems] = useState<StagedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [overrideAccounts, setOverrideAccounts] = useState<Record<string, string>>({});

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
    } catch (err: any) {
      setError(err.message || "Failed to load staged transactions");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await uploadCSVStagedTransactions(organizationId, file);
      setNotice(`✅ CSV Uploaded Successfully: ${res.insertedCount} new transactions staged for review.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to upload CSV");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleGenerateSampleCSV = async () => {
    setIsUploading(true);
    setError(null);
    setNotice(null);

    const sampleCSV = `Transaction Date,Payee / Description,Amount,Reference Number
2026-03-01,AWS Cloud Infrastructure Services,-450.00,AWS-994821
2026-03-02,Stripe Client Revenue Payment,3250.00,STRIPE-88123
2026-03-03,Google Workspace Enterprise Subscription,-120.00,GSuite-33211
2026-03-04,WeWork Office Space Lease,-1800.00,WEWORK-9901
2026-03-05,Client Invoice #1042 Direct Deposit,5000.00,INV-1042`;

    try {
      const res = await uploadCSVStagedTransactions(organizationId, sampleCSV);
      setNotice(`⚡ Sample Bank CSV Generated & Staged: ${res.insertedCount} transactions added.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to generate sample CSV");
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
    } catch (err: any) {
      setError(err.message || "Failed to approve transaction");
    }
  };

  const handleReject = async (item: StagedTransaction) => {
    try {
      const updated = await rejectStagedTransaction(organizationId, item.id);
      setStagedItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...updated, status: "REJECTED" } : i))
      );
    } catch (err: any) {
      setError(err.message || "Failed to reject transaction");
    }
  };

  const handleBatchPost = async () => {
    const approvedCount = stagedItems.filter((i) => i.status === "APPROVED").length;
    if (approvedCount === 0) {
      setError("No APPROVED transactions available for batch posting.");
      return;
    }

    setIsPosting(true);
    setError(null);
    setNotice(null);

    try {
      const result: BatchPostResult = await batchPostStagedTransactions(organizationId);
      setNotice(
        `🎉 Batch Post Successful: ${result.postedEntriesCount} journal entries created in General Ledger ($${(result.totalDebitsMinorUnits / 100).toFixed(2)} debited/credited).`
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to execute batch posting");
    } finally {
      setIsPosting(false);
    }
  };

  const approvedCount = stagedItems.filter((i) => i.status === "APPROVED").length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto mb-2" />
        Loading Staged Transactions & Rule Engine...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900">CSV Staging & Review Queue</h3>
          <p className="text-xs text-slate-500">
            Automated SHA-256 deduplication, rule-matching categorization, and batch posting engine
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleGenerateSampleCSV}
            disabled={isUploading}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
          >
            {isUploading ? "Staging..." : "⚡ Auto-Generate Sample Bank CSV"}
          </button>

          <label className="cursor-pointer rounded-xl bg-slate-100 border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition">
            <span>📁 Upload Bank CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>

          <button
            onClick={handleBatchPost}
            disabled={isPosting || approvedCount === 0}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-40"
          >
            {isPosting ? "Posting Batch..." : `⚡ Batch Post Approved (${approvedCount})`}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold">
        {["ALL", "PENDING", "APPROVED", "REJECTED", "POSTED"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`pb-2.5 transition border-b-2 ${
              statusFilter === st
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {st} ({stagedItems.filter((i) => st === "ALL" || i.status === st).length})
          </button>
        ))}
      </div>

      {/* Staged Transactions Table */}
      {stagedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-slate-900 font-bold">No staged transactions found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Upload a bank statement CSV or click &quot;Auto-Generate Sample Bank CSV&quot; to test rule matching and batch journal posting.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5 text-right">Amount ($)</th>
                <th className="px-4 py-3.5">Suggested Account / Rule Match</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
              {stagedItems
                .filter((item) => statusFilter === "ALL" || item.status === statusFilter)
                .map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 text-slate-600 font-medium">{item.transactionDate}</td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span className={item.amountMinorUnits < 0 ? "text-rose-600" : "text-emerald-600"}>
                        {(item.amountMinorUnits / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans">
                      {item.status === "PENDING" ? (
                        <select
                          value={overrideAccounts[item.id] || item.suggestedAccountId || ""}
                          onChange={(e) =>
                            setOverrideAccounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">-- Rule Suggested: {item.suggestedAccountCode || "None"} --</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.accountCode} - {acc.name} ({acc.accountType})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-700 font-medium">
                          {item.suggestedAccountCode ? `${item.suggestedAccountCode} - ${item.suggestedAccountName}` : "Categorized"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          item.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : item.status === "POSTED"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      {item.status === "PENDING" && (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleApprove(item)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(item)}
                            className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
