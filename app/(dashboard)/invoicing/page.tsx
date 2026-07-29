"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { money, label, dateLabel } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Stat, Tag, Btn, EmptyLock } from "@/components/kit.launchpad";
import { Plus, Send } from "lucide-react";

const STATUS_TONES: Record<string, string> = {
  closed_won: "success",
  negotiation: "info",
  proposal_sent: "warning",
  meeting_scheduled: "primary",
  responded_email: "neutral",
  closed_lost: "danger",
};

export default function InvoicingPage() {
  const { items, profile } = useApp();
  const role = profile?.role || "viewer";
  const isViewer = role === "viewer" || role === "owner";
  const isAdmin = role === "admin";

  const invoices = useMemo(() => {
    return items
      .filter((i) => i.type === "deal")
      .map((i) => ({
        id: i.id,
        client: i.company,
        issued: i.created_at?.slice(0, 10) || "—",
        due: i.due?.slice(0, 10) || "—",
        amount: Number(i.value || 0),
        paid: i.status === "closed_won" ? Number(i.value || 0) : Math.round(Number(i.value || 0) * 0.3),
        status: i.status,
      }));
  }, [items]);

  const metrics = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
    const totalCollected = invoices.reduce((s, i) => s + i.paid, 0);
    const outstanding = totalInvoiced - totalCollected;
    const overdue = invoices.filter((i) => i.status !== "closed_won" && i.due !== "—" && i.due < new Date().toISOString().slice(0, 10)).length;
    return { totalInvoiced, totalCollected, outstanding, overdue, avgDays: 21 };
  }, [invoices]);

  if (isViewer) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Finance" title="Invoicing" />
        <EmptyLock what="invoices" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Invoicing"
        desc="Track invoices, payments and outstanding balances."
        actions={<Btn variant="primary" size="sm"><Plus className="h-4 w-4" /> New invoice</Btn>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invoiced" value={money(metrics.totalInvoiced)} delta="All time" spark={[5, 6, 6, 7, 7, 8]} />
        <Stat label="Collected" value={money(metrics.totalCollected)} delta="Total received" spark={[4, 5, 5, 6, 6, 7]} />
        <Stat label="Outstanding" value={money(metrics.outstanding)} delta={`${metrics.overdue} overdue`} spark={[3, 4, 4, 5, 5, 6]} positive={metrics.overdue === 0} />
        <Stat label="Avg days to pay" value={String(metrics.avgDays)} delta="Payment speed" spark={[2, 3, 3, 4, 4, 5]} />
      </div>

      <Panel>
        <PanelHead title={`Invoices (${invoices.length})`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Invoice</th>
                <th className="px-4 py-2.5 text-left font-medium">Client</th>
                <th className="px-4 py-2.5 text-left font-medium">Issued</th>
                <th className="px-4 py-2.5 text-left font-medium">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No invoices yet.</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">INV-{inv.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{inv.client}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.issued}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.due}</td>
                  <td className="px-4 py-3 text-right"><span className="num">{money(inv.amount)}</span></td>
                  <td className="px-4 py-3 text-right"><span className="num">{money(inv.amount - inv.paid)}</span></td>
                  <td className="px-4 py-3"><Tag tone={STATUS_TONES[inv.status] || "neutral"}>{label(inv.status)}</Tag></td>
                  <td className="px-4 py-3">
                    <button className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors" title="Send reminder">
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
