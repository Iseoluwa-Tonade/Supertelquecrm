"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

export function useToast() {
  return { flash: sonnerToast };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster
        position="top-center"
        duration={2000}
        toastOptions={{
          style: {
            background: "#111827",
            color: "#fff",
            border: "none",
            fontSize: "13px",
            padding: "9px 14px",
            borderRadius: "6px",
            boxShadow: "0 12px 30px rgba(15,23,42,.12)",
          },
        }}
      />
    </>
  );
}
