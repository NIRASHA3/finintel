"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useOrganization } from "../../../lib/context/OrganizationContext";
import { StatusBadge } from "./StatusBadge";

interface TopBarProps {
  onOpenMobileNav: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileNav }) => {
  const {
    user,
    organizations,
    activeOrg,
    switchOrganization,
    healthStatus,
  } = useOrganization();

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation drawer"
            className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15616D]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15616D] rounded-lg p-1"
          >
            <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-[#001524] flex items-center justify-center">
              <Image
                src="/logo_finintel.png"
                alt="FinIntel"
                width={36}
                height={36}
                className="object-contain"
                priority
              />
            </div>
            <div className="hidden sm:block">
              <span className="text-base font-bold text-slate-900 tracking-tight block leading-none">
                FinIntel
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Operations Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Center/Right: Active Organization Selector */}
        <div className="flex items-center gap-2 sm:gap-4">
          {organizations.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="topbar-org-select" className="sr-only">
                Select Active Organization
              </label>
              <div className="relative">
                <select
                  id="topbar-org-select"
                  value={activeOrg?.id || ""}
                  onChange={(e) => switchOrganization(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs sm:text-sm font-semibold rounded-lg pl-3 pr-8 py-2 min-h-[44px] shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15616D] transition cursor-pointer"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.baseCurrency})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {activeOrg && (
                <span className="hidden md:inline-flex items-center px-2 py-1 text-xs font-mono font-bold bg-[#A8EAF8]/50 text-[#004E59] border border-[#15616D]/20 rounded">
                  {activeOrg.baseCurrency}
                </span>
              )}
            </div>
          )}

          {/* Health Status Indicator */}
          <div className="hidden lg:flex items-center">
            <StatusBadge
              status={
                healthStatus === "healthy"
                  ? "HEALTHY"
                  : healthStatus === "unhealthy"
                  ? "OFFLINE"
                  : "UNAVAILABLE"
              }
              label={
                healthStatus === "healthy"
                  ? "API Live"
                  : healthStatus === "unhealthy"
                  ? "Degraded"
                  : "Status unavailable"
              }
              size="sm"
            />
          </div>

          {/* User Profile Area */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-[#001524] text-white flex items-center justify-center font-bold text-xs">
              {user?.fullName ? user.fullName[0].toUpperCase() : "A"}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {user?.fullName || "Development Admin"}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {activeOrg?.role || "OWNER"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
