"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TopBar } from "./TopBar";
import { SidebarNavigation } from "./SidebarNavigation";
import { MobileNavigation } from "./MobileNavigation";
import { useOrganization } from "../../../lib/context/OrganizationContext";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { activeOrg, loading, error } = useOrganization();

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col text-slate-900">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-content">
        Skip to main financial operations content
      </a>

      {/* Mobile Navigation Drawer */}
      <MobileNavigation isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Top Application Bar */}
      <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />

      <div className="flex-1 flex w-full max-w-[1440px] mx-auto">
        {/* Desktop Left Sidebar (Persistent) */}
        <aside
          aria-label="Sidebar Navigation"
          className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] p-4"
        >
          {/* Active Workspace Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 mb-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>WORKSPACE</span>
              <span className="font-mono font-bold text-[#15616D]">{activeOrg?.baseCurrency || "USD"}</span>
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {activeOrg?.name || (loading ? "Loading tenant..." : "No workspace")}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <SidebarNavigation />
          </div>

          {/* Sidebar Footer Info */}
          <div className="pt-4 mt-auto border-t border-slate-200 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-600">FinIntel Core Enterprise</div>
            <p>Double-Entry Ledger Engine &bull; Fixed Precision</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 focus:outline-none"
        >
          {error && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 text-sm font-medium flex items-center justify-between"
            >
              <span>{error}</span>
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Accessible Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-4 mt-auto" role="contentinfo">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <p>&copy; 2026 FinIntel Inc. All rights reserved.</p>
          <div className="flex items-center space-x-4">
            <Link href="/organization" className="hover:text-slate-900 transition">
              Tenant Settings
            </Link>
            <span aria-hidden="true">&bull;</span>
            <Link href="/audit" className="hover:text-slate-900 transition">
              Security Audit
            </Link>
            <span aria-hidden="true">&bull;</span>
            <span>Standard: ISO 4217 / GAAP compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
