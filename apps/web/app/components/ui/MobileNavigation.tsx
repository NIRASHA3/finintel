"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { SidebarNavigation } from "./SidebarNavigation";
import { useOrganization } from "../../../lib/context/OrganizationContext";
import { StatusBadge } from "./StatusBadge";

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ isOpen, onClose }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const { user, activeOrg, healthStatus } = useOrganization();

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);

      // Focus first element in drawer
      setTimeout(() => {
        if (drawerRef.current) {
          const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) focusable[0].focus();
        }
      }, 50);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "unset";
        if (previouslyFocusedRef.current) {
          previouslyFocusedRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className="relative flex flex-col w-full max-w-xs bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-200"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-[#001524] flex items-center justify-center">
              <Image
                src="/logo_finintel.png"
                alt="FinIntel Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-slate-900">FinIntel</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User & Org Badge */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Tenant</span>
            <span className="text-xs font-bold text-[#15616D] font-mono">{activeOrg?.baseCurrency}</span>
          </div>
          <p className="text-sm font-bold text-slate-900 truncate">{activeOrg?.name || "No Organization"}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500 truncate">{user?.email || "dev-admin"}</span>
            <StatusBadge
              status={healthStatus === "healthy" ? "HEALTHY" : "UNAVAILABLE"}
              label={healthStatus === "healthy" ? "Live" : "Unavailable"}
              size="sm"
            />
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-2">
          <SidebarNavigation onItemClick={onClose} />
        </div>
      </div>
    </div>
  );
};
