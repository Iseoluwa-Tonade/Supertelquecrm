"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { money } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Stat, Tag, Btn, Input, Field, DropdownSelect, EmptyLock } from "@/components/kit.launchpad";

const supabase = createClient();

type Invoice = {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  currency: string;
  status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
  issued_at: string | null;
  due_at: string | null;
  total_amount: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
};

const toneForStatus: Record<string, string> = {
  draft: "neutral",
  sent: "primary",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  void: "neutral",
};

export default function InvoicingPage() {
  const { organisation, session, profile } = useApp();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [dueAt, setDueAt] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_invoices")
      .select("*")
      .eq("organisation_id", organisation.id)
      .order("created_at", { ascending: false });
    if (error) flash(error.message);
    setRows((data || []) as Invoice[]);
    setLoading(false);
  }, [organisation?.id, flash]);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const invoiced = rows.filter((r) => r.status !== "void").reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const collected = rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
    const outstanding = Math.max(0, invoiced - collected);
    const paid = rows.filter((r) => r.status === "paid").length;
    return { invoiced, collected, outstanding, paid };
  }, [rows]);

  function openForm() {
    setInvoiceNumber(`INV-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(2, 14)}`);
    setShowForm(true);
  }

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (!organisation?.id || !session?.user.id || !canManage) return;
    const { error } = await supabase.from("crm_invoices").insert({
      organisation_id: organisation.id,
      invoice_number: invoiceNumber.trim(),
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || null,
      currency,
      status: "draft",
      issued_at: issuedAt || null,
      due_at: dueAt || null,
      total_amount: Number(amount) || 0,
      amount_paid: 0,
      notes: notes.trim() || null,
      created_by: session.user.id,
    });
    if (error) { flash(error.message); return; }
    setClientName(""); setClientEmail(""); setDueAt(""); setAmount(""); setNotes("");
    setShowForm(false);
    await load();
    flash("Invoice created");
  }

  async function updateStatus(invoice: Invoice, status: string) {
    if (!organisation?.id || !canManage) return;
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "paid") patch.amount_paid = invoice.total_amount;
    const { error } = await supabase.from("crm_invoices").update(patch).eq("id", invoice.id).eq("organisation_id", organisation.id);
    if (error) { flash(error.message); return; }
    await load();
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader variant="finance" eyebrow="Finance" title="Invoicing" />
        <EmptyLock what="invoices" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="finance"
        eyebrow="Finance"
        title="Invoicing"
        desc="Live invoices and payment status from Supabase."
        actions={
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Btn>
            <Btn variant="primary" size="sm" onClick={openForm}><Plus className="h-4 w-4" />New invoice</Btn>
          </div>
        }
      />

      {showForm && (
        <Panel>
          <PanelHead title="New invoice" />
          <form onSubmit={createInvoice} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Invoice number"><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required /></Field>
            <Field label="Client name"><Input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></Field>
            <Field label="Client email"><Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></Field>
            <DropdownSelect value={currency} onChange={setCurrency} ariaLabel="Currency" placeholder="Choose currency" options={[{ value: "USD", label: "USD" }, { value: "NGN", label: "NGN" }, { value: "GBP", label: "GBP" }, { value: "EUR", label: "EUR" }]} />
            <Field label="Issued"><Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} /></Field>
            <Field label="Due"><Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field>
            <Field label="Amount"><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
            <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2">
              <Btn type="button" onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn type="submit" variant="primary">Save invoice</Btn>
            </div>
          </form>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invoiced" value={money(metrics.invoiced)} delta="Live total" />
        <Stat label="Collected" value={money(metrics.collected)} delta="Recorded payments" />
        <Stat label="Outstanding" value={money(metrics.outstanding)} delta="Open balance" positive={metrics.outstanding === 0} />
        <Stat label="Paid invoices" value={String(metrics.paid)} delta={`${rows.length} total invoices`} />
      </div>

      <Panel>
        <PanelHead title={`Invoices (${rows.length})`} hint="No estimated or fabricated payment amounts" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left">Invoice</th><th className="px-4 py-2.5 text-left">Client</th><th className="px-4 py-2.5 text-left">Issued</th><th className="px-4 py-2.5 text-left">Due</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5 text-right">Paid</th><th className="px-4 py-2.5 text-left">Status</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No live invoices yet.</td></tr> : rows.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3"><p className="font-medium">{inv.client_name}</p><p className="text-xs text-muted-foreground">{inv.client_email || "—"}</p></td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.issued_at || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.due_at || "—"}</td>
                  <td className="px-4 py-3 text-right num">{money(Number(inv.total_amount))}</td>
                  <td className="px-4 py-3 text-right num">{money(Number(inv.amount_paid))}</td>
                  <td className="px-4 py-3">
                    <DropdownSelect value={inv.status} onChange={(value) => updateStatus(inv, value)} ariaLabel={`Status for ${inv.invoice_number}`} placeholder="Choose status" options={["draft","sent","partial","paid","overdue","void"].map((s) => ({ value: s, label: s.replace("_", " ") }))} className="h-8 text-xs" />
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
