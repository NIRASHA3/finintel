import React from "react";

export interface StatusBadgeProps {
  status: "ONLINE" | "DEVELOPMENT" | "OFFLINE";
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const statusStyles = {
    ONLINE: "bg-emerald-100 text-emerald-800 border-emerald-300",
    DEVELOPMENT: "bg-amber-100 text-amber-900 border-amber-300",
    OFFLINE: "bg-rose-100 text-rose-800 border-rose-300",
  };

  const dotStyles = {
    ONLINE: "bg-emerald-500",
    DEVELOPMENT: "bg-amber-500",
    OFFLINE: "bg-rose-500",
  };

  const displayLabel = label || status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${statusStyles[status]}`}
      role="status"
      aria-label={`System status: ${displayLabel}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotStyles[status]}`} aria-hidden="true" />
      {displayLabel}
    </span>
  );
};
