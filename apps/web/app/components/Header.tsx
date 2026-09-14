import React from "react";
import Image from "next/image";

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Image
            src="/logo_finintel.png"
            alt="FinIntel Logo"
            width={180}
            height={56}
            className="h-14 sm:h-16 w-auto object-contain"
            priority
          />
        </div>
        <nav aria-label="Main Navigation" className="hidden sm:block">
          <span className="text-xs font-semibold tracking-wide bg-slate-100/80 text-slate-700 px-4 py-2 rounded-full border border-slate-200 shadow-2xs">
            Enterprise Financial Operations Platform
          </span>
        </nav>
      </div>
    </header>
  );
};
