"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

export interface ToastActions {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastActionContext = createContext<ToastActions | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentMessagesRef = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", title?: string) => {
      // Throttle identical error messages within 2 seconds to avoid toast stacking
      const key = `${type}:${title || ""}:${message}`;
      const now = Date.now();
      const lastSeen = recentMessagesRef.current.get(key) || 0;
      if (now - lastSeen < 2000) {
        return;
      }
      recentMessagesRef.current.set(key, now);

      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => {
        // Keep at most 4 active toasts on screen
        const next = [...prev, { id, type, title, message }];
        return next.slice(-4);
      });

      // Auto-dismiss after 4.5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => showToast(message, "success", title),
    [showToast]
  );
  const error = useCallback(
    (message: string, title?: string) => showToast(message, "error", title),
    [showToast]
  );
  const info = useCallback(
    (message: string, title?: string) => showToast(message, "info", title),
    [showToast]
  );
  const warning = useCallback(
    (message: string, title?: string) => showToast(message, "warning", title),
    [showToast]
  );

  const actions = useMemo<ToastActions>(
    () => ({
      showToast,
      removeToast,
      success,
      error,
      info,
      warning,
    }),
    [showToast, removeToast, success, error, info, warning]
  );

  return (
    <ToastActionContext.Provider value={actions}>
      {children}
      {/* Toast Notification Region */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-card bg-white transition-all transform duration-200 ease-out ${
              t.type === "success"
                ? "border-emerald-300 border-l-4 border-l-emerald-600 text-slate-900"
                : t.type === "error"
                ? "border-rose-300 border-l-4 border-l-[#BA1A1A] text-slate-900"
                : t.type === "warning"
                ? "border-amber-300 border-l-4 border-l-[#FF7D00] text-slate-900"
                : "border-slate-300 border-l-4 border-l-[#15616D] text-slate-900"
            }`}
          >
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-sm font-bold text-slate-900">{t.title}</p>}
              <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
              className="inline-flex items-center justify-center min-w-[32px] min-h-[32px] p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-[#15616D]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastActionContext.Provider>
  );
}

export function useToast(): ToastActions {
  const context = useContext(ToastActionContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
