"use client";

import { useEffect, useState, useCallback, useRef, createContext, useContext, type ReactNode } from "react";

interface ToastContextType {
  flash: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ flash: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 1300);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ flash }}>
      {children}
      <div
        className={`fixed bottom-[18px] left-1/2 -translate-x-1/2 bg-[#111827] text-white px-3 py-[9px] rounded-[6px] text-[13px]
          shadow-[0_12px_30px_rgba(15,23,42,.08)] pointer-events-none transition-all duration-[180ms] z-50
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[20px]"}
        `}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}
