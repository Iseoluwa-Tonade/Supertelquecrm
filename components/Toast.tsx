"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

export function useToast() {
  return {
    flash: (msg: string) =>
      sonnerToast(msg, {
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      }),
    success: (msg: string) => sonnerToast.success(msg),
    error: (msg: string) => sonnerToast.error(msg),
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster
        position="top-center"
        duration={3500}
        gap={10}
        toastOptions={{
          style: {
            background: "#111827",
            color: "#f1f5f9",
            border: "none",
            fontSize: "13px",
            padding: "10px 16px",
            borderRadius: "8px",
            boxShadow: "0 12px 30px rgba(15,23,42,.18)",
            gap: "8px",
          },
        }}
      />
    </>
  );
}
