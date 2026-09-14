import React from "react";
import { CurrencyAmount } from "./CurrencyAmount";

export interface MetricCardProps {
  title: string;
  amountMinorUnits?: number;
  value?: string | number;
  currency?: string;
  periodDescription?: string;
  statusBadge?: React.ReactNode;
  icon?: React.ReactNode;
  highlightDirection?: boolean;
  reverseHighlight?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  amountMinorUnits,
  value,
  currency = "USD",
  periodDescription,
  statusBadge,
  icon,
  highlightDirection = false,
  reverseHighlight = false,
  className = "",
}) => {
  return (
    <div
      className={`p-5 rounded-xl border border-slate-200 bg-white shadow-card transition-all hover:shadow-md ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {amountMinorUnits !== undefined ? (
            <CurrencyAmount
              amountMinorUnits={amountMinorUnits}
              currency={currency}
              highlightDirection={highlightDirection}
              reverseHighlight={reverseHighlight}
            />
          ) : (
            <span className="tnum font-mono">{value}</span>
          )}
        </div>
        {statusBadge && <div>{statusBadge}</div>}
      </div>

      {periodDescription && (
        <p className="mt-1.5 text-xs text-slate-500 font-medium">
          {periodDescription}
        </p>
      )}
    </div>
  );
};
