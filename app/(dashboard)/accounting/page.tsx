"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { money, label } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Stat, Tag, EmptyLock } from "@/components/kit.launchpad";

const EXPENSE_MIX = [
  { category: "Payroll", amount: 58400, share: 48 },
  { category: "Software & tools", amount: 18200, share: 15 },
  { category: "Office & facilities", amount: 14600, share: 12 },
  { category: "Marketing", amount: 12200, share: 10 },
  { category: "Travel & logistics", amount: 9200, share: 8 },
  { category: "Professional fees", amount: 8800, share: 7 },
];

export default function AccountingPage() {
  const { items, profile } = useApp();
  const isAdmin = profile?.role === "admin";

  const ledger = useMemo(() => {
    return items
      .filter((i) => i.type === "deal" && i.status === "closed_won")
      .slice(0, 5)
      .map((i) => ({
        date: i.due?.slice(0, 10) || "—",
        ref: `REF-${i.id.slice(0, 8).toUpperCase()}`,
        account: "Sales Revenue",
        memo: `${i.company} - ${i.title}`,
        debit: 0,
        credit: Number(i.value || 0),
      }));
  }, [items]);

  const totalRevenue = useMemo(() => items.reduce((s, i) => s + Number(i.value || 0), 0), [items]);
  const totalExpenses = EXPENSE_MIX.reduce((s, e) => s + e.amount, 0);
  const netMargin = totalRevenue ? Math.round(((totalRevenue - totalExpenses) / totalRevenue) * 100) : 0;

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader variant="finance" eyebrow="Finance" title="Accounting" />
        <EmptyLock what="accounting and ledger data" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader variant="finance"
        eyebrow="Finance"
        title="Accounting"
        desc="General ledger, expenses and financial overview."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cash on hand" value={money(412800)} delta="+3.2% vs last month" spark={[38, 39, 40, 41, 41, 41]} />
        <Stat label="Revenue (MTD)" value={money(totalRevenue)} delta="This month" spark={[4, 5, 6, 5, 7, 6]} />
        <Stat label="Expenses (MTD)" value={money(totalExpenses)} delta="This month" spark={[5, 5, 6, 6, 6, 5]} positive={false} />
        <Stat label="Net margin" value={`${netMargin}%`} delta="Profitability" spark={[30, 32, 34, 33, 35, netMargin]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="General ledger" hint="Recent journal entries" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ref</th>
                  <th className="px-4 py-2.5 text-left font-medium">Account</th>
                  <th className="px-4 py-2.5 text-left font-medium">Memo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No ledger entries yet.</td></tr>
                ) : ledger.map((e, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{e.ref}</td>
                    <td className="px-4 py-3 text-foreground">{e.account}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{e.memo}</td>
                    <td className="px-4 py-3 text-right"><span className="num text-success">{e.debit ? money(e.debit) : "—"}</span></td>
                    <td className="px-4 py-3 text-right"><span className="num text-destructive">{e.credit ? money(e.credit) : "—"}</span></td>
                  </tr>
                ))}
                <tr className="bg-surface-raised font-medium">
                  <td colSpan={4} className="px-4 py-3 text-right text-foreground">Totals</td>
                  <td className="px-4 py-3 text-right"><span className="num text-success">{money(0)}</span></td>
                  <td className="px-4 py-3 text-right"><span className="num text-destructive">{money(totalRevenue)}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Expense mix" hint="Monthly breakdown" />
          <div className="space-y-3 p-4">
            {EXPENSE_MIX.map((e) => (
              <div key={e.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground">{e.category}</span>
                  <span className="num text-muted-foreground">{e.share}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-destructive/60" style={{ width: `${e.share}%` }} />
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{money(e.amount)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
