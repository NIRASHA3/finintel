"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchAccounts,
  seedDefaultAccounts,
  createAccount,
  Account,
} from "../../lib/api-client";

interface Props {
  organizationId: string;
}

export function ChartOfAccountsView({ organizationId }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Form State
  const [accountCode, setAccountCode] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [accountType, setAccountType] = useState<
    "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
  >("ASSET");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccounts(organizationId);
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || "Failed to load Chart of Accounts");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSeed = async () => {
    setIsSeeding(true);
    setError(null);
    try {
      const seeded = await seedDefaultAccounts(organizationId);
      setAccounts(seeded);
    } catch (err: any) {
      setError(err.message || "Failed to seed default accounts");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountCode.trim() || !name.trim()) return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await createAccount(organizationId, {
        accountCode: accountCode.trim(),
        name: name.trim(),
        accountType,
      });
      setAccounts((prev) => [...prev, created].sort((a, b) => a.accountCode.localeCompare(b.accountCode)));
      setAccountCode("");
      setName("");
      setShowAddModal(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "ASSET":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "LIABILITY":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "EQUITY":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "REVENUE":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "EXPENSE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-2" />
        Loading Chart of Accounts...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Chart of Accounts (COA)</h3>
          <p className="text-xs text-slate-400">
            Categorized account structure for double-entry financial posting
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {accounts.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {isSeeding ? "Seeding Template..." : "⚡ Seed Standard COA Template"}
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.98] transition"
          >
            + Add Custom Account
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Account Table */}
      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center">
          <p className="text-sm text-slate-300 font-medium">No accounts in Chart of Accounts</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click &quot;Seed Standard COA Template&quot; to automatically populate standard Assets, Liabilities, Equity, Revenue, and Expense accounts.
          </p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-medium text-white shadow-lg hover:bg-emerald-500 transition"
          >
            {isSeeding ? "Seeding..." : "Seed Standard COA Template"}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Account Name</th>
                <th className="px-5 py-3.5">Category Type</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-3 font-mono font-bold text-emerald-400">
                    {acc.accountCode}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-100">{acc.name}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold ${getTypeBadge(
                        acc.accountType
                      )}`}
                    >
                      {acc.accountType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center text-[10px] text-emerald-400">
                      ● Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100">Add New Account</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/20">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Account Code *
                </label>
                <input
                  type="text"
                  required
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="e.g. 1050"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Petty Cash Account"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Account Type *
                </label>
                <select
                  value={accountType}
                  onChange={(e: any) => setAccountType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
