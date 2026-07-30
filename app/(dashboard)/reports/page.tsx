"use client";

import { useApp } from "@/lib/AppContext";
import { PageHeader, Panel, PanelHead } from "@/components/kit.launchpad";

const REPORTS = [
  { title: "Monthly activity summary", type: "PDF", period: "Jul 2026", author: "Simi Bello", status: "Final" },
  { title: "Q2 Pipeline review", type: "Slides", period: "Q2 2026", author: "Tunde Bakare", status: "Draft" },
  { title: "Client satisfaction survey", type: "Spreadsheet", period: "H1 2026", author: "Amara Okafor", status: "Final" },
];

export default function ReportsPage() {
  const { profile } = useApp();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader variant="operations"
        eyebrow="Operations"
        title="Reports"
        desc="Submitted reports and generated documents."
      />

      <Panel>
        <PanelHead title={`All reports (${REPORTS.length})`} />
        <div className="divide-y divide-border">
          {REPORTS.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.type} · {r.period} · {r.author}</p>
              </div>
              <span className="label-tag text-muted-foreground">{r.status}</span>
            </div>
          ))}
          {REPORTS.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No reports yet.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
