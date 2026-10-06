"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { money } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Stat, Tag, Btn, Input, Field, DropdownSelect, EmptyLock } from "@/components/kit.launchpad";

const supabase = createClient();

type FinanceEntry = {
  id: string;
  entry_type: "income" | "expense";
  account: string;
  reference: string | null;
  memo: string | null;
  amount: number;
  currency: string;
  occurred_at: string;
  created_at: string;
};

export default function AccountingPage() {
  const { organisation, session, profile } = useApp();
  const { flash } = useToast();
  const isAdmin = profile?.role === "admin";

  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [entryType, setEntryType] = useState("income");
  const [account, setAccount] = useState("");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_finance_entries")
      .select("*")
      .eq("organisation_id", organisation.id)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) flash(error.message);
    setEntries((data || []) as FinanceEntry[]);
    setLoading(false);
  }, [organisation?.id, flash]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const metrics = useMemo(() => {
    const income = entries.filter((e) => e.entry_type === "income").reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenses = entries.filter((e) => e.entry_type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { income, expenses, net: income - expenses, count: entries.length };
  }, [entries]);

  const expenseMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries.filter((row) => row.entry_type === "expense")) {
      map.set(e.account, (map.get(e.account) || 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries()).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
  }, [entries]);

  async function addEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!organisation?.id || !session?.user.id || !isAdmin) return;
    const { error } = await supabase.from("crm_finance_entries").insert({
      organisation_id: organisation.id,
      entry_type: entryType,
      account: account.trim(),
      reference: reference.trim() || null,
      memo: memo.trim() || null,
      amount: Number(amount) || 0,
      currency,
      occurred_at: occurredAt,
      created_by: session.user.id,
    });
    if (error) { flash(error.message); return; }
    setAccount(""); setReference(""); setMemo(""); setAmount("");
    setShowForm(false);
    await load();
    flash("Finance entry saved");
  }

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
      <PageHeader
        variant="finance"
        eyebrow="Finance"
        title="Accounting"
        desc="Live income and expense ledger."
        actions={
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Btn>
            <Btn variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4" />Add transaction</Btn>
          </div>
        }
      />

      {showForm && (
        <Panel>
          <PanelHead title="Add finance entry" />
          <form onSubmit={addEntry} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            <DropdownSelect value={entryType} onChange={setEntryType} ariaLabel="Entry type" placeholder="Choose type" options={[{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }]} />
            <Field label="Account"><Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. Sales revenue" required /></Field>
            <Field label="Amount"><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
            <DropdownSelect value={currency} onChange={setCurrency} ariaLabel="Currency" placeholder="Choose currency" options={[{ value: "USD", label: "USD" }, { value: "NGN", label: "NGN" }, { value: "GBP", label: "GBP" }, { value: "EUR", label: "EUR" }]} />
            <Field label="Date"><Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} /></Field>
            <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
            <Field label="Memo"><Input value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
            <div className="flex items-end justify-end gap-2"><Btn type="button" onClick={() => setShowForm(false)}>Cancel</Btn><Btn type="submit" variant="primary">Save</Btn></div>
          </form>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Income" value={money(metrics.income)} delta="Recorded live" />
        <Stat label="Expenses" value={money(metrics.expenses)} delta="Recorded live" positive={metrics.expenses === 0} />
        <Stat label="Net cash flow" value={money(metrics.net)} delta="Income minus expenses" positive={metrics.net >= 0} />
        <Stat label="Ledger entries" value={String(metrics.count)} delta="Live entries" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="General ledger" hint="Live journal entries" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Date</th><th className="px-4 py-2.5 text-left">Type</th><th className="px-4 py-2.5 text-left">Account</th><th className="px-4 py-2.5 text-left">Reference</th><th className="px-4 py-2.5 text-left">Memo</th><th className="px-4 py-2.5 text-right">Amount</th>
              </tr></thead>
              <tbody>
                {entries.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No live finance entries yet.</td></tr> : entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{e.occurred_at}</td>
                    <td className="px-4 py-3"><Tag tone={e.entry_type === "income" ? "success" : "danger"}>{e.entry_type}</Tag></td>
                    <td className="px-4 py-3 font-medium">{e.account}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.reference || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.memo || "—"}</td>
                    <td className={`px-4 py-3 text-right num ${e.entry_type === "income" ? "text-success" : "text-destructive"}`}>{money(Number(e.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Expense mix" hint="Live expense accounts" />
          <div className="space-y-3 p-4">
            {expenseMix.length === 0 ? <p className="text-sm text-muted-foreground">No expenses recorded yet.</p> : expenseMix.map((e) => {
              const pct = metrics.expenses ? Math.round((e.value / metrics.expenses) * 100) : 0;
              return <div key={e.category}>
                <div className="flex items-center justify-between text-xs"><span>{e.category}</span><span className="num text-muted-foreground">{money(e.value)} · {pct}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-destructive/60" style={{ width: `${pct}%` }} /></div>
              </div>;
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
