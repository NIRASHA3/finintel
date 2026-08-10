import React from "react";
import { StatusBadge } from "./components/StatusBadge";

export default function HomePage() {
  return (
    <div className="max-w-container mx-auto px-4 py-12">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-navy tracking-tight">
              FinIntel Platform
            </h1>
            <p className="text-slate-600 mt-1">
              Multi-Tenant Financial Operations SaaS & Accounting Engine
            </p>
          </div>
          <div>
            <StatusBadge status="DEVELOPMENT" label="Milestone 1 - Under Active Engineering" />
          </div>
        </div>

        <div className="mt-8 space-y-6 text-slate-700">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h2 className="text-lg font-bold text-brand-navy mb-2">
              System Engineering Foundation Established
            </h2>
            <p className="text-sm leading-relaxed">
              This application shell represents the core web client foundation for FinIntel.
              Component architecture, design tokens, layout landmarks, accessibility compliance,
              and contract foundations have been initialized according to system specifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-lg border border-slate-200 bg-white">
              <h3 className="font-semibold text-brand-navy text-base mb-1">Architecture</h3>
              <p className="text-xs text-slate-500">Modular Monolith monorepo layout with Go REST API and Next.js App Router UI.</p>
            </div>

            <div className="p-5 rounded-lg border border-slate-200 bg-white">
              <h3 className="font-semibold text-brand-navy text-base mb-1">Tenant Isolation</h3>
              <p className="text-xs text-slate-500">Shared-schema PostgreSQL data model with composite tenant-safe keys and RLS defense-in-depth.</p>
            </div>

            <div className="p-5 rounded-lg border border-slate-200 bg-white">
              <h3 className="font-semibold text-brand-navy text-base mb-1">Accounting Invariants</h3>
              <p className="text-xs text-slate-500">Fixed-precision arithmetic, double-entry equality, entry immutability, and atomic audit logging.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
