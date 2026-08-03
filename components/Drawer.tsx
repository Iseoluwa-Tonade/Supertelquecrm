"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  const isLg = size === "lg";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Dark Overlay Background */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Desktop Slide-In Drawer (Height Full, configurable width, Right side of Page) */}
          <motion.aside
            key="drawer-panel-desktop"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className={cn(
              "fixed inset-y-0 right-0 z-[101] hidden md:flex flex-col border-l border-border bg-[linear-gradient(180deg,rgba(17,26,40,.98),rgba(17,26,40,.94))] text-crm-sidebar-text shadow-2xl",
              isLg ? "w-[min(70%,68rem)] min-w-[360px]" : "w-[40%] min-w-[340px]",
            )}
          >
            <DrawerHeader title={title} onClose={onClose} />
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{children}</div>
          </motion.aside>

          {/* Mobile Modal (Full-screen for lg, slide-up sheet otherwise) */}
          <motion.aside
            key="drawer-panel-mobile"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[101] flex md:hidden flex-col bg-[linear-gradient(180deg,rgba(17,26,40,.98),rgba(17,26,40,.94))] text-crm-sidebar-text shadow-2xl overflow-hidden",
              isLg ? "inset-0 h-full w-full rounded-none border-0" : "h-[70vh] w-full rounded-t-2xl border-t border-border",
            )}
          >
            {!isLg && (
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>
            )}
            <DrawerHeader title={title} onClose={onClose} />
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5">
      <p className="truncate text-base font-semibold leading-tight">{title}</p>
      <button
        onClick={onClose}
        aria-label="Close"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-crm-sidebar-muted transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

