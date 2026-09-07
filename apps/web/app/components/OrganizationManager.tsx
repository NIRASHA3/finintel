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
import { FinancialReportsView } from "./FinancialReportsView";
import { FiscalPeriodsView } from "./FiscalPeriodsView";
import { AuditTrailView } from "./AuditTrailView";
import { DashboardOverviewView } from "./DashboardOverviewView";
import { AnomalyReviewView } from "./AnomalyReviewView";

export function OrganizationManager() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "anomalies" | "overview" | "coa" | "ledger" | "staging" | "reports" | "periods" | "audit">("dashboard");

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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <span className="text-sm font-medium">Connecting to FinIntel Core API...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Workspace Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shadow-xs">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <h2 className="text-lg font-bold text-slate-900">
                {activeOrg ? activeOrg.name : "No Workspace Selected"}
              </h2>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                Active Tenant
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              User: <span className="text-slate-800 font-semibold">{user?.fullName || "Development Admin"}</span> ({user?.email}) &bull; Role: <span className="font-mono font-bold text-emerald-700">{activeOrg?.role || "OWNER"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {organizations.length > 0 && (
            <select
              value={activeOrg?.id || ""}
              onChange={(e) => {
                const selected = organizations.find((o) => o.id === e.target.value);
                if (selected) setActiveOrg(selected);
              }}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Onboard Workspace</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <p className="font-semibold">API Notice</p>
          <p className="mt-0.5 text-rose-600">{error}</p>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      {activeOrg && (
        <div className="space-y-6">
          <div className="flex overflow-x-auto p-1.5 bg-slate-200/60 rounded-2xl border border-slate-200/80 gap-1.5 text-xs font-bold">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "dashboard"
                  ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              Executive Dashboard
            </button>
            <button
              onClick={() => setActiveTab("anomalies")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "anomalies"
                  ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              Anomaly Queue
            </button>
            <button
              onClick={() => setActiveTab("coa")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "coa"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              Chart of Accounts (COA)
            </button>
            <button
              onClick={() => setActiveTab("ledger")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "ledger"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              General Ledger Entries
            </button>
            <button
              onClick={() => setActiveTab("staging")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "staging"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              CSV Staging & Review Queue
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "reports"
                  ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              Financial Reports
            </button>
            <button
              onClick={() => setActiveTab("periods")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "periods"
                  ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              Fiscal Periods
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "audit"
                  ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              Audit Trail
            </button>
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                activeTab === "overview"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              Tenant Details
            </button>
          </div>

          {/* Subviews */}
          {activeTab === "dashboard" && <DashboardOverviewView organizationId={activeOrg.id} />}
          {activeTab === "anomalies" && <AnomalyReviewView organizationId={activeOrg.id} />}
          {activeTab === "coa" && <ChartOfAccountsView organizationId={activeOrg.id} />}
          {activeTab === "ledger" && <JournalLedgerView organizationId={activeOrg.id} />}
          {activeTab === "staging" && <StagedTransactionsView organizationId={activeOrg.id} />}
          {activeTab === "reports" && <FinancialReportsView organization={activeOrg} />}
          {activeTab === "periods" && <FiscalPeriodsView organization={activeOrg} />}
          {activeTab === "audit" && <AuditTrailView organization={activeOrg} />}

          {/* Tab: Tenant Details */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Currency</p>
                <p className="mt-2 text-2xl font-black text-emerald-600">
                  {activeOrg.baseCurrency}
                </p>
                <p className="mt-1 text-xs text-slate-400">ISO 4217 Currency Standard</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fiscal Start Month</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  Month {activeOrg.fiscalYearStartMonth}
                </p>
                <p className="mt-1 text-xs text-slate-400">Accounting Period Alignment</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant Safety Key</p>
                <p className="mt-2 font-mono text-xs font-bold text-slate-700 truncate">
                  {activeOrg.id}
                </p>
                <p className="mt-1 text-xs text-slate-400">Shared-Schema RLS Data Isolation</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Onboard New Workspace
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="mt-4 space-y-4">
              {createError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Financial Ltd"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Base Currency
                  </label>
                  <select
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Fiscal Start Month
                  </label>
                  <select
                    value={fiscalMonth}
                    onChange={(e) => setFiscalMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={1}>January (Month 1)</option>
                    <option value={4}>April (Month 4)</option>
                    <option value={7}>July (Month 7)</option>
                    <option value={10}>October (Month 10)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
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
