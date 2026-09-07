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

    </div>
  );
}
