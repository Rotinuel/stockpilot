"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/utils/cn";

const ToastContext = createContext(null);

const ICONS = { success: CircleCheck, error: CircleX, info: Info, warning: TriangleAlert };
const TONES = {
  success: "text-emerald-600",
  error: "text-rose-600",
  info: "text-sky-600",
  warning: "text-amber-600",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, title, message, duration = 4500) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, title, message }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (title, message) => push("success", title, message),
      error: (title, message) => push("error", title, message, 7000),
      info: (title, message) => push("info", title, message),
      warning: (title, message) => push("warning", title, message, 6000),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-pop">
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TONES[t.type])} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-slate-900">{t.title}</p>
                {t.message ? <p className="mt-0.5 text-slate-600">{t.message}</p> : null}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
