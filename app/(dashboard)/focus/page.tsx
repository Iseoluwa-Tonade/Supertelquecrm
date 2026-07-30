"use client";

import KanbanBoard from "@/components/KanbanBoard";
import { Focus } from "lucide-react";

export default function FocusPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-700 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-5 shadow-[0_16px_38px_-28px_rgba(15,23,42,0.36)] sm:px-6">
        <div className="flex items-center gap-3">
          <Focus className="h-5 w-5 text-blue-100" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-100">Delivery</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-white">Focus board</h1>
          </div>
        </div>
      </div>
      <KanbanBoard view="focus" />
    </div>
  );
}
