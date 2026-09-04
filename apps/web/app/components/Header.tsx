import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-lg text-white shadow-sm">
            F
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-slate-900">FinIntel</span>
            <span className="ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              SaaS Engine
            </span>
          </div>
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
