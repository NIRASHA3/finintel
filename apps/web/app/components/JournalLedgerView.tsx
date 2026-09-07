"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchJournalEntries,
  fetchAccounts,
  postJournalEntry,
  postJournalEntryReversal,
  JournalEntry,
  Account,
} from "../../lib/api-client";

interface Props {
  organizationId: string;
}

interface FormLine {
  accountId: string;
  debitDollars: string;
  creditDollars: string;
  memo: string;
}

export function JournalLedgerView({ organizationId }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPostModal, setShowPostModal] = useState<boolean>(false);

  // Reversal Modal state
  const [reversingEntry, setReversingEntry] = useState<JournalEntry | null>(null);
  const [reversalReason, setReversalReason] = useState<string>("");
  const [isReversing, setIsReversing] = useState<boolean>(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [lines, setLines] = useState<FormLine[]>([
    { accountId: "", debitDollars: "", creditDollars: "", memo: "" },
    { accountId: "", debitDollars: "", creditDollars: "", memo: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [eData, aData] = await Promise.all([
        fetchJournalEntries(organizationId),
        fetchAccounts(organizationId),
      ]);
      setEntries(eData);
      setAccounts(aData);
    } catch (err: any) {
      setError(err.message || "Failed to load General Ledger entries");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute live double-entry equality
  const totalDebitMinor = lines.reduce((sum, l) => {
    const val = parseFloat(l.debitDollars) || 0;
    return sum + Math.round(val * 100);
  }, 0);

  const totalCreditMinor = lines.reduce((sum, l) => {
    const val = parseFloat(l.creditDollars) || 0;
    return sum + Math.round(val * 100);
  }, 0);

  const isBalanced =
    totalDebitMinor > 0 &&
    totalCreditMinor > 0 &&
    totalDebitMinor === totalCreditMinor;

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { accountId: "", debitDollars: "", creditDollars: "", memo: "" },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (
    index: number,
    field: keyof FormLine,
    value: string
  ) => {
    setLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };

      if (field === "debitDollars" && value !== "") {
        line.creditDollars = "";
      } else if (field === "creditDollars" && value !== "") {
        line.debitDollars = "";
      }

      updated[index] = line;
      return updated;
    });
  };

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced || !description.trim()) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const linePayloads = lines.map((l) => ({
        accountId: l.accountId,
        debitAmountMinorUnits: Math.round((parseFloat(l.debitDollars) || 0) * 100),
        creditAmountMinorUnits: Math.round((parseFloat(l.creditDollars) || 0) * 100),
        memo: l.memo.trim(),
      }));

      const posted = await postJournalEntry(organizationId, {
        description: description.trim(),
        transactionDate,
        lines: linePayloads,
      });

      setEntries((prev) => [posted, ...prev]);
      setShowPostModal(false);
      setDescription("");
      setLines([
        { accountId: "", debitDollars: "", creditDollars: "", memo: "" },
        { accountId: "", debitDollars: "", creditDollars: "", memo: "" },
      ]);
    } catch (err: any) {
      setFormError(err.message || "Failed to post journal entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingEntry || !reversalReason.trim()) return;

    setIsReversing(true);
    setReversalError(null);
    try {
      const reversalResult = await postJournalEntryReversal(
        organizationId,
        reversingEntry.id,
        reversalReason.trim()
      );

      // Refresh list
      await loadData();
      setReversingEntry(null);
      setReversalReason("");
    } catch (err: any) {
      setReversalError(err.message || "Failed to post entry reversal");
    } finally {
      setIsReversing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto mb-2" />
        Loading General Ledger Entries...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900">General Ledger Entries</h3>
          <p className="text-xs text-slate-500">
            Immutable double-entry journal postings & linked reversal entries
          </p>
        </div>

        <button
          onClick={() => setShowPostModal(true)}
          disabled={accounts.length === 0}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50"
        >
          + Post Journal Entry
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 font-medium">
          ⚠️ Please seed or create accounts in the <strong>Chart of Accounts</strong> tab before posting journal entries.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {/* Ledger Table */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-slate-900 font-bold">No posted journal entries</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click &quot;Post Journal Entry&quot; to record balanced debit and credit ledger transactions with atomic audit trail tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                entry.reversedByEntryId
                  ? "border-rose-200 bg-rose-50/20"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-emerald-700">
                    Entry #{entry.entryNumber}
                  </span>
                  <span className="text-slate-500 font-medium">
                    Date: <strong className="text-slate-800">{entry.transactionDate}</strong>
                  </span>
                  {entry.reversedByEntryId && (
                    <span className="rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                      REVERSED
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-slate-900 font-bold">{entry.description}</span>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    {entry.status}
                  </span>
                  {!entry.reversedByEntryId && (
                    <button
                      onClick={() => setReversingEntry(entry)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-[11px] font-bold shadow-2xs transition-colors"
                    >
                      Reverse Entry
                    </button>
                  )}
                </div>
              </div>

              {/* Entry Lines Table */}
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-5 py-2.5">Account</th>
                    <th className="px-5 py-2.5">Memo</th>
                    <th className="px-5 py-2.5 text-right">Debit ($)</th>
                    <th className="px-5 py-2.5 text-right">Credit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {entry.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 font-mono">
                        <span className="text-indigo-600 font-bold">{l.accountCode || "----"}</span> - <span className="font-sans font-medium text-slate-900">{l.accountName || l.accountId}</span>
                      </td>
                      <td className="px-5 py-2.5 text-slate-500">{l.memo || "-"}</td>
                      <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-900">
                        {l.debitAmountMinorUnits > 0
                          ? (l.debitAmountMinorUnits / 100).toFixed(2)
                          : "-"}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-900">
                        {l.creditAmountMinorUnits > 0
                          ? (l.creditAmountMinorUnits / 100).toFixed(2)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Post Entry Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Post Double-Entry Journal Transaction
                </h3>
                <p className="text-xs text-slate-500">
                  Strict invariant: Total Debits must equal Total Credits
                </p>
              </div>
              <button
                onClick={() => setShowPostModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePostEntry} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Monthly SaaS Subscription Invoice"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Line items editor */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
                  <span>Entry Lines (Min. 2)</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-emerald-700 hover:text-emerald-800 text-xs font-bold"
                  >
                    + Add Line
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center rounded-xl bg-slate-50 p-2.5 border border-slate-200"
                  >
                    <div className="col-span-4">
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">-- Select Account --</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.accountCode} - {acc.name} ({acc.accountType})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Debit ($)"
                        value={line.debitDollars}
                        onChange={(e) => handleLineChange(idx, "debitDollars", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 text-right font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Credit ($)"
                        value={line.creditDollars}
                        onChange={(e) => handleLineChange(idx, "creditDollars", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 text-right font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-between">
                      <input
                        type="text"
                        placeholder="Memo"
                        value={line.memo}
                        onChange={(e) => handleLineChange(idx, "memo", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                      {lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="ml-1 text-slate-400 hover:text-rose-600 font-bold px-1"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Real-time Double-Entry Equality Indicator */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-600 font-medium">Total Debits: </span>
                  <strong className="font-mono text-slate-900">
                    ${(totalDebitMinor / 100).toFixed(2)}
                  </strong>
                  <span className="mx-3 text-slate-300">|</span>
                  <span className="text-slate-600 font-medium">Total Credits: </span>
                  <strong className="font-mono text-slate-900">
                    ${(totalCreditMinor / 100).toFixed(2)}
                  </strong>
                </div>

                <div>
                  {isBalanced ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                      ✓ Balanced (Debits = Credits)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                      ✕ Unbalanced (${Math.abs(totalDebitMinor - totalCreditMinor) / 100} discrepancy)
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isBalanced}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition"
                >
                  {isSubmitting ? "Posting..." : "Post Journal Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {reversingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reverse Journal Entry #{reversingEntry.entryNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Post an atomic Linked Reversal with swapped debit and credit lines
                </p>
              </div>
              <button
                onClick={() => setReversingEntry(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteReversal} className="mt-4 space-y-4">
              {reversalError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 font-medium">
                  {reversalError}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-800">Target Entry Details:</div>
                <div className="text-slate-600">
                  Description: <strong className="text-slate-900">{reversingEntry.description}</strong>
                </div>
                <div className="text-slate-600">
                  Transaction Date: <strong className="text-slate-900">{reversingEntry.transactionDate}</strong>
                </div>
                <div className="text-slate-600">
                  Line Count: <strong className="text-slate-900">{reversingEntry.lines.length} lines</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Reversal *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Correcting duplicate vendor payment entry per audit review."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReversingEntry(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReversing || !reversalReason.trim()}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-40 transition"
                >
                  {isReversing ? "Posting Reversal..." : "Post Reversal Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
