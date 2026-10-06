"use client";

import { Printer } from "lucide-react";

export default function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-slate-800 print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print invoice
    </button>
  );
}
