import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white text-slate-500 py-6 border-t border-slate-200 mt-auto" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs">
        <p className="font-medium text-slate-600">© {new Date().getFullYear()} FinIntel Platform. All rights reserved.</p>
        <p className="text-slate-400 mt-2 sm:mt-0 font-medium">
          Multi-Tenant SaaS • Fixed-Precision Ledger • RLS Isolation
        </p>
      </div>
    </footer>
  );
};
