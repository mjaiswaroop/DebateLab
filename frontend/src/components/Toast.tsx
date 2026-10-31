"use client";

import React, { useState, useCallback, createContext, useContext } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  toast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, toast: addToast, removeToast }}>
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto transform transition-all duration-300 ease-out flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-2xl animate-slide-in ${
              t.type === "success"
                ? "bg-neutral-950/80 border-emerald-500/40 text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.15)]"
                : t.type === "error"
                ? "bg-neutral-950/80 border-rose-500/40 text-rose-200 shadow-[0_10px_30px_rgba(244,63,94,0.15)]"
                : "bg-neutral-950/80 border-[#fcdbe8]/40 text-[#fcdbe8] shadow-[0_10px_30px_rgba(252,219,232,0.15)]"
            }`}
            style={{
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)",
            }}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium leading-snug">
              <span className="shrink-0 p-1 rounded-xl bg-white/5 border border-white/10">
                {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {t.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                {t.type === "info" && <Info className="w-4 h-4 text-[#fcdbe8]" />}
              </span>
              <span>{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

