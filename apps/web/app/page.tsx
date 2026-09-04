import React from "react";
import { StatusBadge } from "./components/StatusBadge";
import { OrganizationManager } from "./components/OrganizationManager";

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            FinIntel Operations Console
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium">
            Multi-Tenant Financial Operations SaaS & Fixed-Precision Double-Entry Ledger Engine
          </p>
        </div>
        <div>
          <StatusBadge status="ONLINE" label="Core API & Operations Live" />
        </div>
      </div>

      {/* Main Workspace Component */}
      <OrganizationManager />

      {/* System Core Architecture Summary */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          System Core Invariants & Architecture
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed mb-5">
          FinIntel enforces strict double-entry ledger equality, composite multi-tenant RLS data safety, and append-only atomic audit logging.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <h3 className="font-semibold text-slate-900 text-xs mb-1">Core Architecture</h3>
            <p className="text-xs text-slate-600">Go 1.22 REST API with Chi router, Pgx pool, and Next.js 15 App Router web client.</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <h3 className="font-semibold text-slate-900 text-xs mb-1">Tenant Isolation</h3>
            <p className="text-xs text-slate-600">Shared-schema PostgreSQL data model with composite tenant safety keys and RLS policies.</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <h3 className="font-semibold text-slate-900 text-xs mb-1">Accounting Invariants</h3>
            <p className="text-xs text-slate-600">Fixed-precision integer minor units, period locking safeguards, and atomic audit logging.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
