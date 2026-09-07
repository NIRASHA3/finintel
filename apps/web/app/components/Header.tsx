import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="/logo.png"
            alt="FinIntel Logo"
            className="h-10 w-auto object-contain"
          />
        </div>
        <nav aria-label="Main Navigation" className="hidden sm:block">
          <span className="text-xs font-medium tracking-wide bg-slate-100 text-slate-600 px-3.5 py-1.5 rounded-full border border-slate-200">
            Enterprise Financial Operations Platform
          </span>
        </nav>
      </div>
    </header>
  );
};
