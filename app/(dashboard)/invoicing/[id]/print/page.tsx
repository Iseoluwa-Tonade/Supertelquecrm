"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/AppContext";
import { Btn } from "@/components/kit.launchpad";

const supabase = createClient();

type Invoice = {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  currency: string;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  total_amount: number;
  amount_paid: number;
  notes: string | null;
};

function currency(value: number, code: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code || "USD",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${code || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { organisation } = useApp();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !organisation?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("crm_invoices")
        .select("id,invoice_number,client_name,client_email,currency,status,issued_at,due_at,total_amount,amount_paid,notes")
        .eq("id", id)
        .eq("organisation_id", organisation.id)
        .maybeSingle();
      if (!cancelled) {
        setInvoice((data as Invoice | null) || null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, organisation?.id]);

  const balance = useMemo(
    () => Math.max(0, Number(invoice?.total_amount || 0) - Number(invoice?.amount_paid || 0)),
    [invoice],
  );

  if (loading) {
    return <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">Loading invoice…</div>;
  }

  if (!invoice) {
    return <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">Invoice not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex justify-end print:hidden">
          <Btn variant="primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Btn>
        </div>

        <article className="rounded-2xl border border-border bg-white p-8 text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <header className="flex items-start justify-between gap-8 border-b border-slate-200 pb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Invoice</p>
              <h1 className="mt-2 text-3xl font-bold">{invoice.invoice_number}</h1>
              <div className="mt-4 space-y-1 text-sm text-slate-600">
                <p>{organisation?.name || "Supertelque LLC"}</p>
                {organisation?.email ? <p>{organisation.email}</p> : null}
                {organisation?.phone ? <p>{organisation.phone}</p> : null}
                {organisation?.website ? <p>{organisation.website}</p> : null}
                {organisation?.address ? <p>{organisation.address}</p> : null}
              </div>
            </div>

            <div className="text-right text-sm">
              <p className="font-semibold uppercase tracking-wide text-slate-500">{invoice.status}</p>
              <div className="mt-4 space-y-1 text-slate-600">
                <p><span className="font-medium text-slate-900">Issued:</span> {invoice.issued_at || "—"}</p>
                <p><span className="font-medium text-slate-900">Due:</span> {invoice.due_at || "—"}</p>
              </div>
            </div>
          </header>

          <section className="grid gap-8 py-8 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bill to</p>
              <p className="mt-2 text-lg font-semibold">{invoice.client_name}</p>
              {invoice.client_email ? <p className="mt-1 text-sm text-slate-600">{invoice.client_email}</p> : null}
            </div>

            <div className="md:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Amount due</p>
              <p className="mt-2 text-3xl font-bold">{currency(balance, invoice.currency)}</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-4">
                    <p className="font-medium">Professional services</p>
                    {invoice.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{invoice.notes}</p> : null}
                  </td>
                  <td className="px-4 py-4 text-right font-medium">{currency(invoice.total_amount, invoice.currency)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-8 ml-auto max-w-sm space-y-3 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-slate-500">Invoice total</span>
              <span className="font-medium">{currency(invoice.total_amount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-slate-500">Paid</span>
              <span className="font-medium">{currency(invoice.amount_paid, invoice.currency)}</span>
            </div>
            <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 text-base">
              <span className="font-semibold">Balance due</span>
              <span className="font-bold">{currency(balance, invoice.currency)}</span>
            </div>
          </section>

          <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
            Generated from the live Supertelque CRM invoice record.
          </footer>
        </article>
      </div>
    </div>
  );
}
