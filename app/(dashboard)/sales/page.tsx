"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { money, label, dateLabel } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Stat, Tag, EmptyLock, Btn } from "@/components/kit.launchpad";
import { Plus } from "lucide-react";
import Link from "next/link";

const STATUS_TONES: Record<string, string> = {
  responded_email: "warning",
  meeting_scheduled: "info",
  proposal_sent: "primary",
  negotiation: "accent",
  closed_won: "success",
  closed_lost: "danger",
  project_done: "success",
  project_delivered: "success",
  project_closed: "neutral",
  project_backlog: "neutral",
};

export default function SalesPage() {
  const { items, profile } = useApp();
  const role = profile?.role || "viewer";
  const isViewer = role === "viewer";

  const deals = useMemo(() => items.filter((i) => i.type === "deal"), [items]);
  const activeDeals = useMemo(() => deals.filter((i) => !["closed_won", "closed_lost"].includes(i.status)), [deals]);
  const wonDeals = useMemo(() => deals.filter((i) => i.status === "closed_won"), [deals]);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const metrics = useMemo(() => {
    const ordersThisMonth = deals.filter((d) => (d.due || "").startsWith(thisMonth));
    const orderValue = ordersThisMonth.reduce((s, d) => s + Number(d.value || 0), 0);
    const avgOrderSize = ordersThisMonth.length ? Math.round(orderValue / ordersThisMonth.length) : 0;
    const winRate = deals.length ? Math.round((wonDeals.length / deals.length) * 100) : 0;
    return { ordersThisMonth: ordersThisMonth.length, orderValue, avgOrderSize, winRate };
  }, [deals, wonDeals, thisMonth]);

  if (isViewer) {
    return (
      <div className="space-y-6">
        <PageHeader variant="revenue" eyebrow="Revenue" title="Sales" />
        <EmptyLock what="sales figures" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader variant="revenue"
        eyebrow="Revenue"
        title="Sales"
        desc="Track orders, quota attainment and won revenue."
        actions={<Link href="/pipeline"><Btn variant="primary" size="sm"><Plus className="h-4 w-4" /> New deal</Btn></Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders this month" value={String(metrics.ordersThisMonth)} delta="Live deal records" />
        <Stat label="Order value" value={money(metrics.orderValue)} delta="This month" />
        <Stat label="Avg order size" value={money(metrics.avgOrderSize)} delta="Per deal" />
        <Stat label="Win rate" value={`${metrics.winRate}%`} delta="Overall" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Sales orders" hint="All deal records" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Deal</th>
                  <th className="px-4 py-2.5 text-left font-medium">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium">Rep</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No deals yet.</td></tr>
                ) : deals.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{d.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.company}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.owner}</td>
                    <td className="px-4 py-3 text-right"><span className="num">{money(Number(d.value || 0))}</span></td>
                    <td className="px-4 py-3"><Tag tone={STATUS_TONES[d.status] || "neutral"}>{label(d.status)}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHead title="Won revenue by rep" hint="Live closed-won value" />
            <div className="space-y-3 p-4">
              {wonDeals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No closed-won deals yet.</p>
              ) : (
                [...new Set(wonDeals.map((d) => d.owner))].slice(0, 5).map((rep) => {
                  const repValue = wonDeals.filter((d) => d.owner === rep).reduce((s, d) => s + Number(d.value || 0), 0);
                  return (
                    <div key={rep} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                      <span className="text-foreground">{rep}</span>
                      <span className="num font-semibold text-foreground">{money(repValue)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Won revenue" hint="Last 6 months" />
            <div className="p-4">
              {wonDeals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No won revenue yet.</p>
              ) : (
                <div className="flex items-end gap-2" style={{ height: 80 }}>
                  {Array.from({ length: 6 }, (_, i) => {
                    const m = new Date();
                    m.setMonth(m.getMonth() - (5 - i));
                    const monthKey = m.toISOString().slice(0, 7);
                    const val = wonDeals.filter((d) => (d.due || "").startsWith(monthKey)).reduce((s, d) => s + Number(d.value || 0), 0);
                    const max = Math.max(1, ...Array.from({ length: 6 }, (_, j) => {
                      const mm = new Date(); mm.setMonth(mm.getMonth() - (5 - j));
                      return wonDeals.filter((d) => (d.due || "").startsWith(mm.toISOString().slice(0, 7))).reduce((s, d) => s + Number(d.value || 0), 0);
                    }));
                    return (
                      <div key={monthKey} className="flex flex-1 flex-col items-center gap-1">
                        <span className="num text-[10px] text-muted-foreground">{money(val)}</span>
                        <div className="w-full rounded-sm bg-primary/25 transition-all" style={{ height: `${Math.max(8, (val / max) * 100)}%` }} />
                        <span className="text-[10px] text-muted-foreground">{m.toLocaleString("default", { month: "short" })}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
