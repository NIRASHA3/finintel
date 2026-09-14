import React from "react";

interface CurrencyAmountProps {
  amountMinorUnits: number;
  currency?: string;
  className?: string;
  showSign?: boolean;
  highlightDirection?: boolean; // If true, positive = green/credit/gain, negative = red/debit/loss
  reverseHighlight?: boolean; // For expenses/liabilities where positive = warning
}

export const CurrencyAmount: React.FC<CurrencyAmountProps> = ({
  amountMinorUnits,
  currency = "USD",
  className = "",
  showSign = false,
  highlightDirection = false,
  reverseHighlight = false,
}) => {
  const isZero = amountMinorUnits === 0;
  const isNegative = amountMinorUnits < 0;
  const absAmount = Math.abs(amountMinorUnits) / 100;

  // Format using standard Intl NumberFormat
  let formattedNumber = "";
  try {
    formattedNumber = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absAmount);
  } catch {
    formattedNumber = `${currency.toUpperCase()} ${absAmount.toFixed(2)}`;
  }

  // Determine sign and text indicator
  let signText = "";
  let directionLabel = "";

  if (isNegative) {
    signText = "- ";
    directionLabel = " (Loss)";
  } else if (!isZero && showSign) {
    signText = "+ ";
  }

  // Determine color styling if highlighted
  let colorClass = "text-slate-900";
  if (highlightDirection && !isZero) {
    if (isNegative) {
      colorClass = reverseHighlight ? "text-emerald-700" : "text-[#BA1A1A]";
    } else {
      colorClass = reverseHighlight ? "text-[#BA1A1A]" : "text-emerald-700";
    }
  }

  return (
    <span
      className={`tnum font-mono font-medium tracking-tight whitespace-nowrap ${colorClass} ${className}`}
      data-tabular="true"
    >
      {signText}
      {formattedNumber}
      {isNegative && <span className="sr-only">{directionLabel}</span>}
    </span>
  );
};
