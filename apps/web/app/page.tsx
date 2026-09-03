import React from "react";
import { StatusBadge } from "./components/StatusBadge";
import { OrganizationManager } from "./components/OrganizationManager";

export default function HomePage() {
  return (
    <div className="max-w-container mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            FinIntel Platform
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Autonomous Multi-Tenant Financial Operations SaaS & Accounting Engine
          </p>
        </div>
        <div>
          <StatusBadge status="ONLINE" label="Milestone 2 - Auth & REST API Live" />
        </div>
      </div>

      {/* Organization Manager Component */}
      <OrganizationManager />

      {/* Architecture Foundations Summary */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 backdrop-blur-lg shadow-xl">
        <h2 className="text-lg font-bold text-slate-100 mb-2">
          System Core Invariants & Architecture
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          FinIntel combines strict double-entry ledger equality with provider-neutral authentication, composite tenant keys, and append-only atomic audit logging.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50">
            <h3 className="font-semibold text-slate-200 text-sm mb-1">Architecture</h3>
            <p className="text-xs text-slate-400">Go 1.22 REST API Core with Chi Router, Pgx pool, and Next.js 15 App Router client.</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50">
            <h3 className="font-semibold text-slate-200 text-sm mb-1">Tenant Isolation</h3>
            <p className="text-xs text-slate-400">Shared-schema PostgreSQL data model with composite tenant safety keys and RLS policies.</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50">
            <h3 className="font-semibold text-slate-200 text-sm mb-1">Accounting Invariants</h3>
            <p className="text-xs text-slate-400">Fixed-precision integer minor units (sum of Debits equals sum of Credits) and atomic audit logs.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
