import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "card" | "table" | "metric" | "line" | "circle";
  count?: number;
}

export const LoadingSkeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "line",
  count = 1,
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === "metric") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" role="status" aria-busy="true" aria-label="Loading metrics">
        {items.map((idx) => (
          <div key={idx} className="p-5 rounded-xl border border-slate-200 bg-white shadow-card animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden" role="status" aria-busy="true" aria-label="Loading table data">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="h-5 bg-slate-200 rounded w-48 animate-pulse" />
          <div className="h-8 bg-slate-200 rounded w-28 animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100 p-4 space-y-3">
          {items.map((idx) => (
            <div key={idx} className="flex items-center justify-between py-2 animate-pulse">
              <div className="space-y-1.5 w-1/3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-4 bg-slate-200 rounded w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`p-6 rounded-xl border border-slate-200 bg-white shadow-card animate-pulse space-y-4 ${className}`} role="status" aria-busy="true" aria-label="Loading card content">
        <div className="h-5 bg-slate-200 rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-5/6" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} role="status" aria-busy="true" aria-label="Loading content">
      {items.map((idx) => (
        <div key={idx} className="h-4 bg-slate-200 rounded animate-pulse w-full" />
      ))}
    </div>
  );
};
