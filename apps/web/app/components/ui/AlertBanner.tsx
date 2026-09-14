import React from "react";

interface AlertBannerProps {
  type?: "error" | "warning" | "info" | "success";
  title?: string;
  message: string;
  onRetry?: () => void;
  onClose?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = "error",
  title,
  message,
  onRetry,
  onClose,
  className = "",
}) => {
  const styles = {
    error: {
      container: "bg-rose-50 border-rose-200 text-rose-950",
      accent: "border-l-4 border-l-[#BA1A1A]",
      icon: (
        <svg className="w-5 h-5 text-[#BA1A1A] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    warning: {
      container: "bg-amber-50 border-amber-200 text-amber-950",
      accent: "border-l-4 border-l-[#FF7D00]",
      icon: (
        <svg className="w-5 h-5 text-[#FF7D00] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      container: "bg-sky-50 border-sky-200 text-sky-950",
      accent: "border-l-4 border-l-[#15616D]",
      icon: (
        <svg className="w-5 h-5 text-[#15616D] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    success: {
      container: "bg-emerald-50 border-emerald-200 text-emerald-950",
      accent: "border-l-4 border-l-emerald-600",
      icon: (
        <svg className="w-5 h-5 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  }[type];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xs ${styles.container} ${styles.accent} ${className}`}
    >
      {styles.icon}
      <div className="flex-1 min-w-0">
        {title && <h4 className="text-sm font-bold leading-tight">{title}</h4>}
        <p className="text-sm mt-0.5 leading-relaxed">{message}</p>
        {onRetry && (
          <div className="mt-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center text-sm font-bold text-[#15616D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15616D] rounded"
            >
              Retry operation
            </button>
          </div>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="text-slate-400 hover:text-slate-700 p-1 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
