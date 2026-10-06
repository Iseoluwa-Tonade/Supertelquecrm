"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Mail, Pencil, Phone, Save, TrendingUp, X } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Btn, DropdownSelect, Field, Input, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type CompanyOption = { id: string; name: string };
type ContactRow = {
  id: string;
  organisation_id: string;
  company_id: string | null;
  display_name: string | null;
  email: string;
  phone: string | null;
  job_title: string | null;
  status: string;
  source: string;
  notes: string;
  last_contacted_at: string | null;
  crm_companies: { id: string; name: string } | null;
};
type ThreadRow = { id: string; subject: string | null; message_count: number; last_message_at: string | null; board_item_id: string | null };
type DealRow = { id: string; title: string; company: string; status: string; value: number };

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, organisation } = useApp();
  const { flash } = useToast();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const canEdit = profile?.role === "admin" || profile?.role === "manager" || profile?.role === "owner";
  const canCreateDeal = profile?.role === "admin" || profile?.role === "manager";

  const [contact, setContact] = useState<ContactRow | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    display_name: "", email: "", phone: "", job_title: "", company_id: "", status: "active", notes: "",
  });

  const loadData = useCallback(async () => {
    if (!id || !organisation?.id) return;
    setLoading(true);
    const [contactRes, companyRes, threadRes, dealRes] = await Promise.all([
      supabase.from("crm_contacts")
        .select("id,organisation_id,company_id,display_name,email,phone,job_title,status,source,notes,last_contacted_at,crm_companies(id,name)")
        .eq("organisation_id", organisation.id).eq("id", id).maybeSingle(),
      supabase.from("crm_companies").select("id,name").eq("organisation_id", organisation.id).order("name"),
      supabase.from("crm_email_threads").select("id,subject,message_count,last_message_at,board_item_id")
        .eq("organisation_id", organisation.id).eq("contact_id", id).order("last_message_at", { ascending: false }),
      supabase.from("crm_board_items").select("id,title,company,status,value")
        .eq("organisation_id", organisation.id).eq("primary_contact_id", id).order("created_at", { ascending: false }),
    ]);

    const next = (contactRes.data as ContactRow | null) || null;
    setContact(next);
    setCompanies((companyRes.data || []) as CompanyOption[]);
    setThreads((threadRes.data || []) as ThreadRow[]);
    setDeals((dealRes.data || []) as DealRow[]);
    if (next) {
      setDraft({
        display_name: next.display_name || "",
        email: next.email || "",
        phone: next.phone || "",
        job_title: next.job_title || "",
        company_id: next.company_id || "",
        status: next.status || "active",
        notes: next.notes || "",
      });
    }
    setLoading(false);
  }, [id, organisation?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveContact() {
    if (!contact || !organisation?.id || !canEdit || !draft.email.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("crm_contacts").update({
      display_name: draft.display_name.trim() || null,
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim() || null,
      job_title: draft.job_title.trim() || null,
      company_id: draft.company_id || null,
      status: draft.status,
      notes: draft.notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq("organisation_id", organisation.id).eq("id", contact.id);
    setSaving(false);
    if (error) return flash(error.message);
    setEditing(false);
    await loadData();
    flash("Contact updated");
  }

  async function createDeal() {
    if (!contact || !profile?.user_id || !organisation?.id || !canCreateDeal) return;
    setCreatingDeal(true);
    const companyName = contact.crm_companies?.name || contact.email.split("@")[1] || "Contact opportunity";
    const { data, error } = await supabase.from("crm_board_items").insert({
      organisation_id: organisation.id,
      company_id: contact.company_id,
      primary_contact_id: contact.id,
      user_id: profile.user_id,
      type: "deal",
      title: "Opportunity with " + (contact.display_name || contact.email),
      company: companyName,
      owner: profile.display_name || profile.email || "Owner",
      assigned_to: profile.user_id,
      priority: "medium",
      value: 0,
      status: "responded_email",
      notes: "Created from CRM contact",
      visibility: "team",
    }).select("id").single();

    if (error || !data?.id) {
      setCreatingDeal(false);
      return flash(error?.message || "Could not create deal");
    }
    await supabase.from("crm_email_threads").update({ board_item_id: data.id })
      .eq("organisation_id", organisation.id).eq("contact_id", contact.id).is("board_item_id", null);
    setCreatingDeal(false);
    router.push("/pipeline/" + data.id);
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading contact…</div>;
  if (!contact) return <div className="space-y-6"><PageHeader eyebrow="CRM contact" title="Contact not found" /><Link href="/contacts"><Btn><ArrowLeft className="h-4 w-4" /> Back to contacts</Btn></Link></div>;

  const displayName = contact.display_name || contact.email;
  return (
    <div className="space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to contacts
      </Link>

      <PageHeader
        variant="revenue"
        eyebrow="CRM contact"
        title={displayName}
        desc={contact.job_title || contact.crm_companies?.name || contact.email}
        actions={<div className="flex gap-2">
          {canEdit ? <Btn size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Btn> : null}
          {canCreateDeal ? <Btn variant="primary" size="sm" onClick={createDeal} disabled={creatingDeal}><TrendingUp className="h-4 w-4" />{creatingDeal ? "Creating…" : "Create deal"}</Btn> : null}
        </div>}
      />

      <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHead title="Contact details" />
            <div className="space-y-3 p-4 text-sm">
              <a href={"mailto:" + contact.email} className="flex items-center gap-2 text-primary hover:underline"><Mail className="h-4 w-4" /> {contact.email}</a>
              {contact.phone ? <a href={"tel:" + contact.phone} className="flex items-center gap-2 hover:text-primary"><Phone className="h-4 w-4" /> {contact.phone}</a> : null}
              {contact.crm_companies ? <Link href={"/clients/" + contact.crm_companies.id} className="flex items-center gap-2 hover:text-primary"><Building2 className="h-4 w-4" /> {contact.crm_companies.name}</Link> : null}
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Source</span><Tag tone="neutral">{contact.source}</Tag></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><Tag tone={contact.status === "active" ? "success" : "neutral"}>{contact.status}</Tag></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Last contacted</span><span>{fmt(contact.last_contacted_at)}</span></div>
              {contact.notes ? <div className="rounded-xl border border-border bg-surface-raised p-3 text-xs leading-5 text-muted-foreground">{contact.notes}</div> : null}
            </div>
          </Panel>

          <Panel>
            <PanelHead title={"Pipeline (" + deals.length + ")"} />
            <div className="divide-y divide-border">
              {deals.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No linked deals yet.</div> : deals.map((deal) => (
                <Link key={deal.id} href={"/pipeline/" + deal.id} className="block p-4 hover:bg-surface-raised">
                  <p className="text-sm font-semibold">{deal.title}</p>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{deal.status}</span><span className="num">{Number(deal.value || 0).toLocaleString()}</span></div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHead title={"Email conversations (" + threads.length + ")"} hint="Linked by email address" />
          <div className="divide-y divide-border">
            {threads.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No synced conversations match this contact yet.</div> : threads.map((thread) => (
              <Link key={thread.id} href={"/emails/" + thread.id} className="block px-4 py-4 hover:bg-surface-raised">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{thread.subject || "(no subject)"}</p><p className="mt-1 text-xs text-muted-foreground">{thread.message_count} message{thread.message_count === 1 ? "" : "s"}</p></div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{fmt(thread.last_message_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {editing ? <div className="fixed inset-0 z-80 grid place-items-center bg-black/45 p-4" onClick={() => setEditing(false)}>
        <div className="w-full max-w-2xl rounded-2xl border border-border bg-popover shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div><p className="label-tag text-primary">Contact record</p><h2 className="mt-1 text-lg font-semibold">Edit contact</h2></div>
            <button onClick={() => setEditing(false)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-surface-raised"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name"><Input value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
            <Field label="Job title"><Input value={draft.job_title} onChange={(e) => setDraft({ ...draft, job_title: e.target.value })} /></Field>
            <Field label="Company"><DropdownSelect value={draft.company_id} onChange={(value) => setDraft({ ...draft, company_id: value })} ariaLabel="Company" placeholder="No company" options={[{ value: "", label: "No company" }, ...companies.map((company) => ({ value: company.id, label: company.name }))]} /></Field>
            <Field label="Status"><DropdownSelect value={draft.status} onChange={(value) => setDraft({ ...draft, status: value })} ariaLabel="Status" placeholder="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={4} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary/60" /></Field></div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-4"><Btn onClick={() => setEditing(false)}>Cancel</Btn><Btn variant="primary" onClick={saveContact} disabled={saving || !draft.email.trim()}><Save className="h-4 w-4" />{saving ? "Saving…" : "Save changes"}</Btn></div>
        </div>
      </div> : null}
    </div>
  );
}
