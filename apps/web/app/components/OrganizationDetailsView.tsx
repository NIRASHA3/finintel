"use client";

import React, { useState, useEffect } from "react";
import {
  fetchOrganizationMembers,
  createOrganization,
  OrgMember,
} from "../../lib/api-client";
import { useOrganization } from "../../lib/context/OrganizationContext";
import { useToast } from "../../lib/context/ToastContext";
import {
  Modal,
  FormField,
  StatusBadge,
  DataTable,
  Column,
  EmptyState,
} from "./ui";

export function OrganizationDetailsView() {
  const {
    user,
    organizations,
    activeOrg,
    refreshOrganizations,
    switchOrganization,
  } = useOrganization();
  const toast = useToast();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Form State for Workspace Onboarding
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [baseCurrency, setBaseCurrency] = useState<string>("USD");
  const [fiscalMonth, setFiscalMonth] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (activeOrg?.id) {
      setLoadingMembers(true);
      fetchOrganizationMembers(activeOrg.id)
        .then((data) => {
          if (active) setMembers(data);
        })
        .catch(() => {
          if (active) setMembers([]);
        })
        .finally(() => {
          if (active) setLoadingMembers(false);
        });
    }
    return () => {
      active = false;
    };
  }, [activeOrg?.id]);

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

      await refreshOrganizations();
      switchOrganization(created.id);
      setNewOrgName("");
      setShowCreateModal(false);
      toast.success(`Organization "${created.name}" onboarded successfully.`, "Workspace Created");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to onboard organization";
      setCreateError(msg);
      toast.error(msg, "Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeOrg) {
    return (
      <EmptyState
        title="No Workspace Selected"
        description="Select or onboard an organization to view tenant configuration."
        actionLabel="Onboard Workspace"
        onAction={() => setShowCreateModal(true)}
      />
    );
  }

  const memberColumns: Column<OrgMember>[] = [
    {
      key: "name",
      header: "Member Name & Email",
      render: (m) => (
        <div>
          <p className="font-semibold text-slate-900">{m.name}</p>
          <span className="text-xs text-slate-500">{m.email}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Assigned Role",
      render: (m) => (
        <span className="font-mono text-xs font-bold text-[#15616D] bg-[#A8EAF8]/40 px-2 py-0.5 rounded border border-[#15616D]/20">
          {m.role}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (m) => <StatusBadge status={m.status || "ACTIVE"} label={m.status || "Active"} size="sm" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {activeOrg.name}
            </h2>
            <StatusBadge status="ONLINE" label="Active Tenant" size="sm" />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Tenant configuration, base currency rules, and role-based access management.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#FF7D00]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Onboard New Workspace</span>
        </button>
      </div>

      {/* Tenant Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-card">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Base Functional Currency
          </span>
          <p className="mt-2 text-3xl font-bold text-[#15616D] font-mono">
            {activeOrg.baseCurrency}
          </p>
          <p className="mt-1 text-xs text-slate-400">ISO 4217 Currency Standard</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-card">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Fiscal Year Start
          </span>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            Month {activeOrg.fiscalYearStartMonth}
          </p>
          <p className="mt-1 text-xs text-slate-400">Accounting Calendar Alignment</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-card">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Tenant Isolation Safety Key
          </span>
          <p className="mt-2 font-mono text-xs font-bold text-slate-700 truncate bg-slate-50 p-2 rounded border border-slate-200">
            {activeOrg.id}
          </p>
          <p className="mt-1 text-xs text-slate-400">Row-Level Security Tenant ID</p>
        </div>
      </div>

      {/* Team & Member Administration Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Tenant Members & Roles</h3>
            <StatusBadge status="PROTOTYPE" label="DEMO / PROTOTYPE" size="sm" />
          </div>
          <p className="text-xs text-slate-500">
            Current user role: <strong className="font-mono text-[#15616D]">{activeOrg.role || "OWNER"}</strong>
          </p>
        </div>

        <DataTable
          columns={memberColumns}
          data={
            members.length > 0
              ? members
              : [
                  {
                    id: "mem-1",
                    user_id: user?.id || "usr-1",
                    email: user?.email || "admin@finintel.io",
                    name: user?.fullName || "Development Admin",
                    role: (activeOrg.role as "Admin" | "Controller" | "Accountant" | "Auditor") || "Admin",
                    status: "ACTIVE",
                    created_at: new Date().toISOString(),
                  },
                ]
          }
          keyExtractor={(m) => m.id}
          loading={loadingMembers}
          emptyTitle="No members listed"
          emptyDescription="Member list is currently operating in prototype mode."
        />
      </div>

      {/* Create Organization Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Onboard New Workspace"
        description="Provision an isolated multi-tenant organization with its own chart of accounts and general ledger."
        maxWidth="md"
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-[#BA1A1A]">
              {createError}
            </div>
          )}

          <FormField id="org-name" label="Legal Organization Name" required>
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="e.g. Acme Corp Ltd"
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
            />
          </FormField>

          <FormField id="org-curr" label="Base Functional Currency" required>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
            >
              <option value="USD">USD - United States Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
              <option value="SGD">SGD - Singapore Dollar</option>
            </select>
          </FormField>

          <FormField id="org-month" label="Fiscal Year Start Month" required>
            <select
              value={fiscalMonth}
              onChange={(e) => setFiscalMonth(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#15616D]"
            >
              <option value={1}>January (Standard Calendar Year)</option>
              <option value={4}>April (UK / Commonwealth Alignment)</option>
              <option value={7}>July (Australian / Mid-Year Alignment)</option>
              <option value={10}>October (US Federal Alignment)</option>
            </select>
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newOrgName.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-[#FF7D00] hover:bg-[#E06E00] rounded-lg shadow-sm transition disabled:opacity-40 min-h-[44px]"
            >
              {isSubmitting ? "Provisioning..." : "Onboard Workspace"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
