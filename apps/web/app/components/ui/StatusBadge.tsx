import React from "react";

export type SystemOrItemStatus =
  | "ONLINE"
  | "DEVELOPMENT"
  | "OFFLINE"
  | "HEALTHY"
  | "UNAVAILABLE"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "POSTED"
  | "LOCKED"
  | "OPEN"
  | "PROTOTYPE"
  | "DEMO"
  | string;

export interface StatusBadgeProps {
  status: SystemOrItemStatus;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = "md",
  className = "",
}) => {
  const normalizedStatus = status.toUpperCase();

  // Distinct shapes and semantic colors to prevent relying on color alone (WCAG 2.2 AA)
  let badgeStyle = "bg-slate-100 text-slate-800 border-slate-300";
  let dotStyle = "bg-slate-500";
  let iconSvg: React.ReactNode = (
    <span className={`rounded-full shrink-0 ${dotStyle} ${size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"}`} aria-hidden="true" />
  );

  switch (normalizedStatus) {
    case "ONLINE":
    case "HEALTHY":
    case "APPROVED":
    case "POSTED":
    case "OPEN":
      badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-300";
      dotStyle = "bg-emerald-600";
      iconSvg = (
        <svg className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} text-emerald-700 shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      );
      break;

    case "REJECTED":
    case "OFFLINE":
      badgeStyle = "bg-rose-50 text-rose-800 border-rose-300";
      dotStyle = "bg-[#BA1A1A]";
      iconSvg = (
        <svg className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} text-[#BA1A1A] shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
      break;

    case "PENDING":
    case "DEVELOPMENT":
      badgeStyle = "bg-amber-50 text-amber-900 border-amber-300";
      dotStyle = "bg-[#FF7D00]";
      iconSvg = (
        <svg className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} text-[#FF7D00] shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      break;

    case "LOCKED":
      badgeStyle = "bg-indigo-50 text-indigo-900 border-indigo-300";
      iconSvg = (
        <svg className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} text-indigo-700 shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
      break;

    case "PROTOTYPE":
    case "DEMO":
      badgeStyle = "bg-[#A8EAF8]/40 text-[#15616D] border-[#15616D]/30";
      iconSvg = (
        <span className="font-mono font-black text-[10px] tracking-wider bg-[#15616D] text-white px-1 py-0.2 rounded" aria-hidden="true">
          DEMO
        </span>
      );
      break;

    case "UNAVAILABLE":
    default:
      badgeStyle = "bg-slate-100 text-slate-700 border-slate-300";
      dotStyle = "bg-slate-400";
      iconSvg = (
        <span className={`rounded-full shrink-0 ${dotStyle} ${size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"}`} aria-hidden="true" />
      );
      break;
  }

  const displayLabel = label || status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
      } ${badgeStyle} ${className}`}
      role="status"
      aria-label={`System status: ${displayLabel}`}
    >
      {iconSvg}
      <span>{displayLabel}</span>
    </span>
  );
};
