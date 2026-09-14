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
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  CurrencyAmount,
  StatusBadge,
  Modal,
  FormField,
  EmptyState,
} from "./ui";

interface Props {
  organizationId?: string;
}

interface FormLine {
  accountId: string;
  debitDollars: string;
  creditDollars: string;
  memo: string;
}

export function JournalLedgerView({ organizationId: propOrgId }: Props) {
  const { activeOrg } = useOrganization();
  const organizationId = propOrgId || activeOrg?.id || "";
  const currency = activeOrg?.baseCurrency || "USD";
  const toast = useToast();

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

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [eRes, aData] = await Promise.all([
        fetchJournalEntries(organizationId),
        fetchAccounts(organizationId),
      ]);
      setEntries(eRes.entries);
      setNextCursor(eRes.nextCursor || null);
      setAccounts(aData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load General Ledger entries";
      setError(msg);
      toast.error(msg, "Data Load Failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchJournalEntries(organizationId, nextCursor);
      setEntries((prev) => [...prev, ...res.entries]);
      setNextCursor(res.nextCursor || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load additional journal entries";
      toast.error(msg, "Pagination Error");
    } finally {
      setLoadingMore(false);
    }
  };

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
      toast.success(`Entry #${posted.entryNumber} posted to General Ledger.`, "Journal Entry Posted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to post journal entry";
      setFormError(msg);
      toast.error(msg, "Posting Error");
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

      setEntries((prev) => [
        reversalResult,
        ...prev.map((item) =>
          item.id === reversingEntry.id
            ? { ...item, status: "REVERSED", reversedByEntryId: reversalResult.id }
            : item
        ),
      ]);

      setReversingEntry(null);
      setReversalReason("");
      toast.success(`Entry reversed by #${reversalResult.entryNumber}.`, "Reversal Created");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reverse journal entry";
      setReversalError(msg);
      toast.error(msg, "Reversal Failed");
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">General Ledger</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable, audit-ready double-entry ledger journals and line details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPostModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Post Manual Entry</span>
        </button>
      </div>

      {/* Entries List */}
      {loading ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-card">
          <div className="w-6 h-6 border-2 border-[#15616D] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">Loading General Ledger entries...</p>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No journal entries posted"
          description="The General Ledger has not recorded any transactions for this organization yet."
          actionLabel="Post First Entry"
          onAction={() => setShowPostModal(true)}
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const entryTotalDebit = entry.lines.reduce((s, l) => s + l.debitAmountMinorUnits, 0);
            const entryTotalCredit = entry.lines.reduce((s, l) => s + l.creditAmountMinorUnits, 0);
            const isEntryBalanced = entryTotalDebit === entryTotalCredit;

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden"
              >
                {/* Entry Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/80 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-300 px-2 py-1 rounded">
                      #{entry.entryNumber}
                    </span>
                    <span className="font-semibold text-sm text-slate-900">{entry.description}</span>
                    <StatusBadge status={entry.status} size="sm" />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Date: <strong className="text-slate-700">{entry.transactionDate}</strong> (UTC)</span>
                    {entry.status === "POSTED" && (
                      <button
                        type="button"
                        onClick={() => {
                          setReversingEntry(entry);
                          setReversalReason("");
                          setReversalError(null);
                        }}
                        className="px-2.5 py-1 font-bold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 rounded-md transition min-h-[32px] focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        Reverse Entry
                      </button>
                    )}
                  </div>
                </div>

                {/* Entry Lines Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30 text-xs text-slate-500 font-semibold">
                        <th className="px-4 py-2">Account Code & Name</th>
                        <th className="px-4 py-2">Line Memo</th>
                        <th className="px-4 py-2 text-right">Debit</th>
                        <th className="px-4 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded mr-2">
                              {line.accountCode || "AC-"}
                            </span>
                            <span className="text-slate-800 font-medium">{line.accountName || line.accountId}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{line.memo || "—"}</td>
                          <td className="px-4 py-2.5 text-right font-mono tnum">
                            {line.debitAmountMinorUnits > 0 ? (
                              <CurrencyAmount amountMinorUnits={line.debitAmountMinorUnits} currency={currency} />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tnum">
                            {line.creditAmountMinorUnits > 0 ? (
                              <CurrencyAmount amountMinorUnits={line.creditAmountMinorUnits} currency={currency} />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-700">
                        <td colSpan={2} className="px-4 py-2 text-right uppercase">Total:</td>
                        <td className="px-4 py-2 text-right font-mono tnum">
                          <CurrencyAmount amountMinorUnits={entryTotalDebit} currency={currency} />
                        </td>
                        <td className="px-4 py-2 text-right font-mono tnum">
                          <CurrencyAmount amountMinorUnits={entryTotalCredit} currency={currency} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

          {nextCursor && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition min-h-[44px] disabled:opacity-50"
              >
                {loadingMore ? "Loading more entries..." : "Load Older Entries"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Post Manual Journal Entry Modal */}
      <Modal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        title="Post Manual Double-Entry Journal"
        description="Every posted entry must satisfy debits = credits before it can be committed to the immutable ledger."
        maxWidth="2xl"
      >
        <form onSubmit={handlePostEntry} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-[#BA1A1A]">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="entry-desc" label="Transaction Description" required>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Month-end revenue accrual"
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
              />
            </FormField>

            <FormField id="entry-date" label="Transaction Date (UTC)" required>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
              />
            </FormField>
          </div>

          {/* Lines Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase">Journal Lines (Debits & Credits)</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-bold text-[#15616D] hover:underline"
              >
                + Add Line
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <select
                    value={line.accountId}
                    onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                    required
                    aria-label={`Account for line ${idx + 1}`}
                    className="flex-1 text-xs bg-white border border-slate-300 rounded px-2 py-1.5 focus-visible:ring-2 focus-visible:ring-[#15616D]"
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountCode} - {a.name} ({a.accountType})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Debit"
                    value={line.debitDollars}
                    onChange={(e) => handleLineChange(idx, "debitDollars", e.target.value)}
                    aria-label={`Debit amount for line ${idx + 1}`}
                    className="w-24 text-xs font-mono text-right bg-white border border-slate-300 rounded px-2 py-1.5"
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Credit"
                    value={line.creditDollars}
                    onChange={(e) => handleLineChange(idx, "creditDollars", e.target.value)}
                    aria-label={`Credit amount for line ${idx + 1}`}
                    className="w-24 text-xs font-mono text-right bg-white border border-slate-300 rounded px-2 py-1.5"
                  />

                  <input
                    type="text"
                    placeholder="Memo"
                    value={line.memo}
                    onChange={(e) => handleLineChange(idx, "memo", e.target.value)}
                    aria-label={`Memo for line ${idx + 1}`}
                    className="w-28 text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
                  />

                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      aria-label={`Remove line ${idx + 1}`}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Live Balance Checker */}
            <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg text-xs font-semibold">
              <span>
                Total Debits: <strong className="font-mono">{currency} {(totalDebitMinor / 100).toFixed(2)}</strong> | Total Credits: <strong className="font-mono">{currency} {(totalCreditMinor / 100).toFixed(2)}</strong>
              </span>
              <span className={`px-2 py-0.5 rounded font-bold ${isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                {isBalanced ? "BALANCED" : "OUT OF BALANCE"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowPostModal(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced || isSubmitting || !description.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition disabled:opacity-40 min-h-[44px]"
            >
              {isSubmitting ? "Posting..." : "Commit Entry to Ledger"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reversal Confirmation Modal */}
      <Modal
        isOpen={Boolean(reversingEntry)}
        onClose={() => setReversingEntry(null)}
        title={`Reverse Journal Entry #${reversingEntry?.entryNumber}`}
        description="Accounting standards require immutable reversals rather than modifying or deleting committed journals."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteReversal} className="space-y-4">
          {reversalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-[#BA1A1A]">
              {reversalError}
            </div>
          )}

          <p className="text-sm text-slate-600">
            Committing this action will post an exact offsetting entry to debit and credit balances.
          </p>

          <FormField id="reversal-reason" label="Audit Reason for Reversal" required>
            <input
              type="text"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Duplicate accrual reversed per auditor request"
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setReversingEntry(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReversing || !reversalReason.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-[#BA1A1A] hover:bg-[#93000A] rounded-lg shadow-sm transition disabled:opacity-40 min-h-[44px]"
            >
              {isReversing ? "Reversing..." : "Confirm Ledger Reversal"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
