"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchJournalEntries,
  postJournalEntry,
  fetchAccounts,
  JournalEntry,
  Account,
} from "../../lib/api-client";

interface Props {
  organizationId: string;
}

interface DraftLine {
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

  // Form State
  const [description, setDescription] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [lines, setLines] = useState<DraftLine[]>([
    { accountId: "", debitDollars: "", creditDollars: "", memo: "" },
    { accountId: "", debitDollars: "", creditDollars: "", memo: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadLedgerData = useCallback(async () => {
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
    loadLedgerData();
  }, [loadLedgerData]);

  // Calculate total debits and credits in minor units
  const totalDebitMinor = lines.reduce((sum, line) => {
    const val = parseFloat(line.debitDollars) || 0;
    return sum + Math.round(val * 100);
  }, 0);

  const totalCreditMinor = lines.reduce((sum, line) => {
    const val = parseFloat(line.creditDollars) || 0;
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
    field: keyof DraftLine,
    value: string
  ) => {
    setLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };

      // If user types debit, clear credit on same line (XOR rule)
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

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-2" />
        Loading General Ledger Entries...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-slate-100">General Ledger Entries</h3>
          <p className="text-xs text-slate-400">
            Immutable double-entry journal postings ($sum(Debits) = sum(Credits)$)
          </p>
        </div>

        <button
          onClick={() => setShowPostModal(true)}
          disabled={accounts.length === 0}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.98] transition disabled:opacity-50"
        >
          + Post Journal Entry
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          ⚠️ Please seed or create accounts in the <strong>Chart of Accounts</strong> tab before posting journal entries.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Ledger Table */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center">
          <p className="text-sm text-slate-300 font-medium">No posted journal entries</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click &quot;Post Journal Entry&quot; to record balanced debit and credit ledger transactions with atomic audit trail tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-3 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-emerald-400">
                    Entry #{entry.entryNumber}
                  </span>
                  <span className="text-slate-400">
                    Date: <strong className="text-slate-200">{entry.transactionDate}</strong>
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-slate-100 font-medium">{entry.description}</span>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    {entry.status}
                  </span>
                </div>
              </div>

              {/* Entry Lines Table */}
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/40 text-slate-400 font-mono text-[10px] border-b border-slate-800/60 uppercase">
                  <tr>
                    <th className="px-5 py-2">Account</th>
                    <th className="px-5 py-2">Memo</th>
                    <th className="px-5 py-2 text-right">Debit ($)</th>
                    <th className="px-5 py-2 text-right">Credit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {entry.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/20">
                      <td className="px-5 py-2 font-mono">
                        <span className="text-emerald-400 font-bold">{l.accountCode || "----"}</span> - {l.accountName || l.accountId}
                      </td>
                      <td className="px-5 py-2 text-slate-400">{l.memo || "-"}</td>
                      <td className="px-5 py-2 text-right font-mono font-medium text-slate-100">
                        {l.debitAmountMinorUnits > 0
                          ? (l.debitAmountMinorUnits / 100).toFixed(2)
                          : "-"}
                      </td>
                      <td className="px-5 py-2 text-right font-mono font-medium text-slate-100">
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

      {/* Post Journal Entry Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Post Double-Entry Journal Transaction
                </h3>
                <p className="text-xs text-slate-400">
                  Strict invariant: Total Debits must equal Total Credits ($sum(Debits) = sum(Credits)$)
                </p>
              </div>
              <button
                onClick={() => setShowPostModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePostEntry} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/20">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Monthly SaaS Subscription Invoice"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Line items editor */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
                  <span>Entry Lines (Min. 2)</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
                  >
                    + Add Line
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center rounded-xl bg-slate-950/40 p-2.5 border border-slate-800/80"
                  >
                    <div className="col-span-4">
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
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
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 text-right font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Credit ($)"
                        value={line.creditDollars}
                        onChange={(e) => handleLineChange(idx, "creditDollars", e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 text-right font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-between">
                      <input
                        type="text"
                        placeholder="Memo"
                        value={line.memo}
                        onChange={(e) => handleLineChange(idx, "memo", e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      {lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="ml-1 text-slate-500 hover:text-rose-400 px-1"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Real-time Double-Entry Equality Indicator */}
              <div className="flex items-center justify-between rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">Total Debits: </span>
                  <strong className="font-mono text-slate-100">
                    ${(totalDebitMinor / 100).toFixed(2)}
                  </strong>
                  <span className="mx-3 text-slate-600">|</span>
                  <span className="text-slate-400">Total Credits: </span>
                  <strong className="font-mono text-slate-100">
                    ${(totalCreditMinor / 100).toFixed(2)}
                  </strong>
                </div>

                <div>
                  {isBalanced ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
                      ✓ Balanced (Debits = Credits)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-rose-500/10 border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-400">
                      ✕ Unbalanced (${Math.abs(totalDebitMinor - totalCreditMinor) / 100} discrepancy)
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isBalanced}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-40 transition"
                >
                  {isSubmitting ? "Posting..." : "Post Journal Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
