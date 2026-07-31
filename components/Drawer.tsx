"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[min(400px,100vw)] flex-col border-l border-border bg-[linear-gradient(180deg,rgba(17,26,40,.96),rgba(17,26,40,.92))] text-crm-sidebar-text shadow-xl md:w-96 max-md:hidden"
          >
            <DrawerHeader title={title} onClose={onClose} />
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">{children}</div>
          </motion.aside>
          <motion.aside
            key="drawer-panel-mobile"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed inset-0 z-50 flex flex-col bg-[linear-gradient(180deg,rgba(17,26,40,.98),rgba(17,26,40,.94))] text-crm-sidebar-text shadow-2xl md:hidden"
          >
            <DrawerHeader title={title} onClose={onClose} />
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
      <p className="truncate text-sm font-semibold leading-tight">{title}</p>
      <button
        onClick={onClose}
        aria-label="Close"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-crm-sidebar-muted transition-colors hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
