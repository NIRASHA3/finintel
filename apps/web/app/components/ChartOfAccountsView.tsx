"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchAccounts,
  seedDefaultAccounts,
  createAccount,
  Account,
} from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  DataTable,
  Modal,
  FormField,
  Column,
} from "./ui";

interface Props {
  organizationId?: string;
}

export function ChartOfAccountsView({ organizationId: propOrgId }: Props) {
  const { activeOrg } = useOrganization();
  const organizationId = propOrgId || activeOrg?.id || "";
  const toast = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
    try {
      const data = await fetchAccounts(organizationId);
      setAccounts(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load Chart of Accounts";
      toast.error(msg, "Data Load Failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const seeded = await seedDefaultAccounts(organizationId);
      setAccounts(seeded);
      toast.success(`${seeded.length} standard accounts seeded successfully.`, "COA Initialized");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to seed default accounts";
      toast.error(msg, "Seed Failed");
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
      setAccounts((prev) =>
        [...prev, created].sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      );
      setAccountCode("");
      setName("");
      setShowAddModal(false);
      toast.success(`Account ${created.accountCode} - ${created.name} created.`, "Account Added");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      setFormError(msg);
      toast.error(msg, "Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "ASSET":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "LIABILITY":
        return "bg-amber-50 text-amber-900 border-amber-300";
      case "EQUITY":
        return "bg-purple-50 text-purple-900 border-purple-300";
      case "REVENUE":
        return "bg-sky-50 text-sky-900 border-sky-300";
      case "EXPENSE":
        return "bg-rose-50 text-rose-900 border-rose-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-300";
    }
  };

  const columns: Column<Account>[] = [
    {
      key: "accountCode",
      header: "Code",
      width: "120px",
      render: (acc) => (
        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
          {acc.accountCode}
        </span>
      ),
    },
    {
      key: "name",
      header: "Account Title",
      render: (acc) => (
        <span className="font-semibold text-slate-900">{acc.name}</span>
      ),
    },
    {
      key: "accountType",
      header: "Classification",
      render: (acc) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTypeBadge(acc.accountType)}`}>
          {acc.accountType}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Operational Status",
      align: "right",
      render: (acc) => (
        <span className={`text-xs font-bold ${acc.isActive ? "text-emerald-700" : "text-slate-400"}`}>
          {acc.isActive ? "Active / Posting Permitted" : "Archived"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-card">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Chart of Accounts (COA)</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Structured standard ledger classifications for assets, liabilities, equity, revenue, and expenses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {accounts.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={isSeeding}
              className="inline-flex items-center justify-center px-3.5 py-2 text-sm font-bold text-[#15616D] bg-[#A8EAF8]/30 border border-[#15616D]/30 hover:bg-[#A8EAF8]/50 rounded-lg transition disabled:opacity-50 min-h-[44px]"
            >
              {isSeeding ? "Seeding..." : "Seed GAAP Accounts"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <DataTable
        columns={columns}
        data={accounts}
        keyExtractor={(acc) => acc.id}
        loading={loading}
        emptyTitle="Chart of accounts is empty"
        emptyDescription="No financial accounts exist for this tenant. Seed standard GAAP accounts or add custom categories."
        emptyActionLabel="Seed Standard GAAP Accounts"
        onEmptyAction={handleSeed}
      />

      {/* Add Account Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Account to Chart of Accounts"
        description="Define a new ledger code and financial statement classification."
        maxWidth="md"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-[#BA1A1A]">
              {formError}
            </div>
          )}

          <FormField id="coa-code" label="Account Code (e.g. 1010, 4010)" required>
            <input
              type="text"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              placeholder="e.g. 1010"
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
            />
          </FormField>

          <FormField id="coa-name" label="Account Title" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operating Checking Account"
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
            />
          </FormField>

          <FormField id="coa-type" label="Account Classification" required>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE")}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
            >
              <option value="ASSET">ASSET (Balance Sheet)</option>
              <option value="LIABILITY">LIABILITY (Balance Sheet)</option>
              <option value="EQUITY">EQUITY (Balance Sheet)</option>
              <option value="REVENUE">REVENUE (Income Statement)</option>
              <option value="EXPENSE">EXPENSE (Income Statement)</option>
            </select>
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !accountCode.trim() || !name.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition disabled:opacity-40 min-h-[44px]"
            >
              {isSubmitting ? "Creating..." : "Save Account"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
