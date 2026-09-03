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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [stagedData, accData] = await Promise.all([
        fetchStagedTransactions(organizationId, statusFilter),
        fetchAccounts(organizationId),
      ]);
      setStagedItems(stagedData);
      setAccounts(accData);
    } catch (err: any) {
      setError(err.message || "Failed to load staged transactions");
    } finally {
      setLoading(false);
    }
  }, [organizationId, statusFilter]);

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
      setNotice(`✅ Successfully processed CSV statement: ${res.insertedCount} new transactions staged (duplicates skipped).`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to upload CSV");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateSampleCSV = async () => {
    setIsUploading(true);
    setError(null);
    setNotice(null);

    const sampleCSV = `Date,Description,Amount,Category
2026-09-01,AWS Cloud Infrastructure Hosting,-450.00,Cloud
2026-09-02,Stripe Monthly SaaS Revenue Payout,2450.00,Revenue
2026-09-03,WeWork Office Monthly Rent,-1200.00,Rent
2026-09-03,GitHub Team Subscription,-84.00,Software
2026-09-04,Monthly Engineering Team Payroll,-3500.00,Payroll`;

    try {
      const res = await uploadCSVStagedTransactions(organizationId, sampleCSV);
      setNotice(`⚡ Demo Sample CSV Staged: ${res.insertedCount} transactions parsed & auto-categorized!`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to stage sample CSV");
    } finally {
      setIsUploading(false);
    }
  };

  const handleApprove = async (item: StagedTransaction, selectedAccId?: string) => {
    const targetId = selectedAccId || item.suggestedAccountId;
    if (!targetId) {
      setError("Please select a target account from the dropdown before approving.");
      return;
    }

    try {
      const updated = await approveStagedTransaction(organizationId, item.id, targetId);
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
      <div className="p-8 text-center text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-2" />
        Loading Staged Transactions & Rule Engine...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-slate-100">CSV Staging & Review Queue</h3>
          <p className="text-xs text-slate-400">
            Automated SHA-256 deduplication, rule-matching categorization, and batch posting engine
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleGenerateSampleCSV}
            disabled={isUploading}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {isUploading ? "Staging..." : "⚡ Auto-Generate Sample Bank CSV"}
          </button>

          <label className="cursor-pointer rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition">
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
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.98] transition disabled:opacity-40"
          >
            {isPosting ? "Posting Batch..." : `⚡ Batch Post Approved (${approvedCount})`}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-xs font-semibold">
        {["ALL", "PENDING", "APPROVED", "REJECTED", "POSTED"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`pb-2.5 transition border-b-2 ${
              statusFilter === st
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {st} ({stagedItems.filter((i) => st === "ALL" || i.status === st).length})
          </button>
        ))}
      </div>

      {/* Staged Transactions Table */}
      {stagedItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center">
          <p className="text-sm text-slate-300 font-medium">No staged transactions found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Upload a bank statement CSV or click &quot;Auto-Generate Sample Bank CSV&quot; to test rule matching and batch journal posting.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount ($)</th>
                <th className="px-4 py-3">Suggested Account / Rule Match</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {stagedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-mono text-slate-400">{item.transactionDate}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{item.description}</div>
                    <div className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]">
                      Hash: {item.rawDataHash.substring(0, 12)}...
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-bold ${
                      item.amountMinorUnits > 0 ? "text-emerald-400" : "text-slate-100"
                    }`}
                  >
                    {item.amountMinorUnits > 0 ? "+" : ""}
                    {(item.amountMinorUnits / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <select
                        value={item.suggestedAccountId || ""}
                        disabled={item.status === "POSTED"}
                        onChange={(e) => handleApprove(item, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">-- Select Target Account --</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.accountCode} - {acc.name} ({acc.accountType})
                          </option>
                        ))}
                      </select>
                      {item.confidenceScore > 0 && (
                        <span className="rounded bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400">
                          Match {Math.round(item.confidenceScore * 100)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                        item.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : item.status === "POSTED"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : item.status === "REJECTED"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {item.status !== "POSTED" && (
                      <>
                        <button
                          onClick={() => handleApprove(item)}
                          className="rounded bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/40 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(item)}
                          className="rounded bg-rose-600/20 border border-rose-500/40 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-600/40 transition"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {item.status === "POSTED" && (
                      <span className="text-[10px] text-slate-500 font-mono">Posted to Ledger</span>
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
