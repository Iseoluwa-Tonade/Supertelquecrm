import { notFound, redirect } from "next/navigation";

import PrintInvoiceButton from "@/components/PrintInvoiceButton";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value + (value.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organisation_id,role,status")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!profile?.organisation_id || profile.status !== "active" || !["admin", "manager"].includes(profile.role)) {
    redirect("/invoicing");
  }

  const [{ data: invoice }, { data: organisation }] = await Promise.all([
    supabase
      .from("crm_invoices")
      .select("*")
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle(),
    supabase
      .from("organisations")
      .select("name,email,phone,address,website")
      .eq("id", profile.organisation_id)
      .maybeSingle(),
  ]);

  if (!invoice) notFound();

  const balance = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0));

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <a href="/invoicing" className="text-sm font-medium text-slate-600 hover:text-slate-950">
            ← Back to invoicing
          </a>
          <PrintInvoiceButton />
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl print:rounded-none print:border-0 print:shadow-none">
          <div className="h-2 bg-slate-950" />

          <div className="grid gap-8 p-8 sm:p-10">
            <header className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Invoice</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">{organisation?.name || "Supertelque"}</h1>
                <div className="mt-3 space-y-1 text-sm text-slate-500">
                  {organisation?.address ? <p>{organisation.address}</p> : null}
                  {organisation?.email ? <p>{organisation.email}</p> : null}
                  {organisation?.phone ? <p>{organisation.phone}</p> : null}
                  {organisation?.website ? <p>{organisation.website}</p> : null}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 sm:min-w-64">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice number</p>
                <p className="mt-1 font-mono text-lg font-semibold">{invoice.invoice_number}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Issued</p>
                    <p className="font-medium">{formatDate(invoice.issued_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Due</p>
                    <p className="font-medium">{formatDate(invoice.due_at)}</p>
                  </div>
                </div>
              </div>
            </header>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill to</p>
                <p className="mt-2 text-lg font-semibold">{invoice.client_name}</p>
                {invoice.client_email ? <p className="mt-1 text-sm text-slate-500">{invoice.client_email}</p> : null}
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
                <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold capitalize">
                  {String(invoice.status || "draft").replaceAll("_", " ")}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1fr_auto] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-5 text-sm">
                <div>
                  <p className="font-semibold">Professional services</p>
                  <p className="mt-1 text-slate-500">{invoice.notes || "Services rendered as agreed."}</p>
                </div>
                <p className="font-semibold">{formatAmount(Number(invoice.total_amount), invoice.currency)}</p>
              </div>
            </div>

            <div className="ml-auto w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Invoice total</span>
                <span className="font-semibold">{formatAmount(Number(invoice.total_amount), invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Amount paid</span>
                <span className="font-semibold">{formatAmount(Number(invoice.amount_paid), invoice.currency)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold">Balance due</span>
                <span className="text-xl font-bold">{formatAmount(balance, invoice.currency)}</span>
              </div>
            </div>

            <footer className="border-t border-slate-200 pt-6 text-xs leading-5 text-slate-500">
              <p>Thank you for your business.</p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
