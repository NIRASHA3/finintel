import React from "react";

export interface StatusBadgeProps {
  status: "ONLINE" | "DEVELOPMENT" | "OFFLINE";
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const statusStyles = {
    ONLINE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DEVELOPMENT: "bg-amber-50 text-amber-800 border-amber-200",
    OFFLINE: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const dotStyles = {
    ONLINE: "bg-emerald-500 animate-pulse",
    DEVELOPMENT: "bg-amber-500",
    OFFLINE: "bg-rose-500",
  };

  const displayLabel = label || status;

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full border shadow-xs ${statusStyles[status]}`}
      role="status"
      aria-label={`System status: ${displayLabel}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotStyles[status]}`} aria-hidden="true" />
      {displayLabel}
    </span>
  );
};
