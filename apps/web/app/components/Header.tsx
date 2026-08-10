import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-brand-navy text-white shadow-md" role="banner">
      <div className="max-w-container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-brand-teal flex items-center justify-center font-bold text-lg text-white">
            F
          </div>
          <span className="text-xl font-bold tracking-tight">FinIntel</span>
        </div>
        <nav aria-label="Main Navigation">
          <span className="text-xs uppercase tracking-wider bg-brand-teal/30 px-3 py-1 rounded-full text-teal-200 border border-teal-500/30">
            Engineering Foundation (Milestone 1)
          </span>
        </nav>
      </div>
    </header>
  );
};
