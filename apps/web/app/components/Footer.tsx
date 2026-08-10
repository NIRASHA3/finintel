import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-900 text-slate-400 py-6 border-t border-slate-800" role="contentinfo">
      <div className="max-w-container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-sm">
        <p>© {new Date().getFullYear()} FinIntel Platform. All rights reserved.</p>
        <p className="text-xs text-slate-500 mt-2 sm:mt-0">
          Multi-Tenant Financial Operations SaaS • Strict Accounting Invariants
        </p>
      </div>
    </footer>
  );
};
