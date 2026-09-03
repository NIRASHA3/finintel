"use client";

import React, { useState, useEffect } from "react";
import {
  fetchCurrentUser,
  fetchUserOrganizations,
  createOrganization,
  Organization,
  UserProfile,
} from "../../lib/api-client";
import { ChartOfAccountsView } from "./ChartOfAccountsView";
import { JournalLedgerView } from "./JournalLedgerView";
import { StagedTransactionsView } from "./StagedTransactionsView";

export function OrganizationManager() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"overview" | "coa" | "ledger" | "staging">("overview");

  // Form state
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [baseCurrency, setBaseCurrency] = useState<string>("USD");
  const [fiscalMonth, setFiscalMonth] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uData, orgsData] = await Promise.all([
        fetchCurrentUser(),
        fetchUserOrganizations(),
      ]);
      setUser(uData);

      const uniqueOrgs = Array.from(
        new Map(orgsData.map((org) => [org.id, org])).values()
      );
      setOrganizations(uniqueOrgs);

      if (uniqueOrgs.length > 0) {
        setActiveOrg((prev) => {
          if (prev && uniqueOrgs.some((o) => o.id === prev.id)) {
            return prev;
          }
          return uniqueOrgs[0];
        });
      } else {
        setActiveOrg(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to connect to FinIntel Core API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const created = await createOrganization({
        name: newOrgName.trim(),
        baseCurrency,
        fiscalYearStartMonth: Number(fiscalMonth),
      });

      const freshOrgs = await fetchUserOrganizations();
      const uniqueOrgs = Array.from(
        new Map([created, ...freshOrgs].map((org) => [org.id, org])).values()
      );

      setOrganizations(uniqueOrgs);
      setActiveOrg(created);
      setNewOrgName("");
      setShowCreateModal(false);
    } catch (err: any) {
      console.error("Failed to onboard organization:", err);
      setCreateError(err.message || "Failed to onboard organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
        <div className="flex items-center space-x-3 text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span>Connecting to FinIntel Core REST API...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Top Banner / API Connection Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-6 shadow-xl backdrop-blur-lg">
        <div className="flex items-center space-x-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m4 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-slate-100">
                {activeOrg ? activeOrg.name : "No Workspace Selected"}
              </h2>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                API Connected
              </span>
            </div>
            <p className="text-xs text-slate-400">
              User: <span className="text-slate-200">{user?.fullName || "Development Admin"}</span> ({user?.email}) &bull; Role: <span className="font-mono text-emerald-400">{activeOrg?.role || "OWNER"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Workspace Switcher */}
          {organizations.length > 0 && (
            <select
              value={activeOrg?.id || ""}
              onChange={(e) => {
                const selected = organizations.find((o) => o.id === e.target.value);
                if (selected) setActiveOrg(selected);
              }}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {organizations.map((org, index) => (
                <option key={`${org.id}-${index}`} value={org.id}>
                  {org.name} ({org.baseCurrency})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Onboard Organization</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          <p className="font-medium">Connection Notice</p>
          <p className="mt-1 text-xs text-rose-400">{error}</p>
        </div>
      )}

      {/* Navigation Tabs for Active Workspace */}
      {activeOrg && (
        <div className="space-y-6">
          <div className="flex border-b border-slate-800 space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 text-xs font-semibold tracking-wide transition border-b-2 ${
                activeTab === "overview"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Workspace Overview
            </button>
            <button
              onClick={() => setActiveTab("coa")}
              className={`pb-3 text-xs font-semibold tracking-wide transition border-b-2 ${
                activeTab === "coa"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Chart of Accounts (COA)
            </button>
            <button
              onClick={() => setActiveTab("ledger")}
              className={`pb-3 text-xs font-semibold tracking-wide transition border-b-2 ${
                activeTab === "ledger"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              General Ledger Entries
            </button>
            <button
              onClick={() => setActiveTab("staging")}
              className={`pb-3 text-xs font-semibold tracking-wide transition border-b-2 ${
                activeTab === "staging"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              CSV Staging & Review Queue
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md">
                <p className="text-xs font-medium text-slate-400">Base Currency</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-emerald-400">
                  {activeOrg.baseCurrency}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">ISO 4217 Currency Code</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md">
                <p className="text-xs font-medium text-slate-400">Fiscal Year Start Month</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-100">
                  Month {activeOrg.fiscalYearStartMonth}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Accounting Period Alignment</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md">
                <p className="text-xs font-medium text-slate-400">Multi-Tenant Key</p>
                <p className="mt-1 font-mono text-xs text-slate-300 truncate">
                  {activeOrg.id}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Composite Tenant Safety Isolation</p>
              </div>
            </div>
          )}

          {/* Tab 2: Chart of Accounts */}
          {activeTab === "coa" && (
            <ChartOfAccountsView organizationId={activeOrg.id} />
          )}

          {/* Tab 3: General Ledger */}
          {activeTab === "ledger" && (
            <JournalLedgerView organizationId={activeOrg.id} />
          )}

          {/* Tab 4: CSV Staging & Review Queue */}
          {activeTab === "staging" && (
            <StagedTransactionsView organizationId={activeOrg.id} />
          )}
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-slate-100">
                Onboard New Organization
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="mt-4 space-y-4">
              {createError && (
                <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/20">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Financial Ltd"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Base Currency
                  </label>
                  <select
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Fiscal Start Month
                  </label>
                  <select
                    value={fiscalMonth}
                    onChange={(e) => setFiscalMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={1}>January (Month 1)</option>
                    <option value={4}>April (Month 4)</option>
                    <option value={7}>July (Month 7)</option>
                    <option value={10}>October (Month 10)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? "Onboarding..." : "Onboard Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
