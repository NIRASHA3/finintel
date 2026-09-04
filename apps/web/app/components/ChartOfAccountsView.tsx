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
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "LIABILITY":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "EQUITY":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "REVENUE":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "EXPENSE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto mb-2" />
        Loading Chart of Accounts...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900">Chart of Accounts (COA)</h3>
          <p className="text-xs text-slate-500">
            Categorized account structure for double-entry financial posting
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {accounts.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
            >
              {isSeeding ? "Seeding Template..." : "⚡ Seed Standard COA Template"}
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            + Add Custom Account
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Account Table */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-slate-900 font-bold">No accounts in Chart of Accounts</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click &quot;Seed Standard COA Template&quot; to automatically populate standard Assets, Liabilities, Equity, Revenue, and Expense accounts.
          </p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            {isSeeding ? "Seeding..." : "Seed Standard COA Template"}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Account Name</th>
                <th className="px-5 py-3.5">Category Type</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5 font-bold text-indigo-600">
                    {acc.accountCode}
                  </td>
                  <td className="px-5 py-3.5 font-sans font-medium text-slate-900">{acc.name}</td>
                  <td className="px-5 py-3.5 font-sans">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-bold ${getTypeBadge(
                        acc.accountType
                      )}`}
                    >
                      {acc.accountType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-sans">
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Active
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add New Account</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Account Code *
                </label>
                <input
                  type="text"
                  required
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="e.g. 1050"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Petty Cash Account"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Account Type *
                </label>
                <select
                  value={accountType}
                  onChange={(e: any) => setAccountType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
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
