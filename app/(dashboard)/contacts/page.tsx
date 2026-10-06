"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownAZ, ArrowUpAZ, Columns3, Mail, Phone, Plus, Search, SlidersHorizontal, X } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Avatar, Btn, Field, Input, PageHeader, Panel, PanelHead, Tag, DropdownSelect } from "@/components/kit.launchpad";

const supabase = createClient();

type Company = { id: string; name: string };
type Contact = {
  id: string;
  company_id: string | null;
  display_name: string | null;
  email: string;
  phone: string | null;
  job_title: string | null;
  status: string;
  source: string;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  company?: Company | null;
};

type ColumnKey = "name" | "email" | "phone" | "company" | "job_title" | "source" | "last_contacted" | "threads";

const ALL_COLUMNS: Array<{ id: ColumnKey; label: string }> = [
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "company", label: "Company" },
  { id: "job_title", label: "Job title" },
  { id: "source", label: "Source" },
  { id: "last_contacted", label: "Last contacted" },
  { id: "threads", label: "Email threads" },
];

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export default function ContactsPage() {
  const { profile, organisation } = useApp();
  const searchParams = useSearchParams();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<ColumnKey[]>(["name","email","company","job_title","source","last_contacted","threads"]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q) setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("crm.contacts.columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setColumns(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("crm.contacts.columns", JSON.stringify(columns)); } catch {}
  }, [columns]);

  const loadData = useCallback(async () => {
    if (!organisation?.id) return;

    const [contactRes, companyRes] = await Promise.all([
      supabase
        .from("crm_contacts")
        .select("id,company_id,display_name,email,phone,job_title,status,source,last_contacted_at,created_at,updated_at,crm_companies(id,name)")
        .eq("organisation_id", organisation.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("crm_companies")
        .select("id,name")
        .eq("organisation_id", organisation.id)
        .order("name", { ascending: true }),
    ]);

    if (contactRes.error) flash(contactRes.error.message);
    if (companyRes.error) flash(companyRes.error.message);

    const nextContacts = (contactRes.data || []).map((row: any) => ({
      ...row,
      company: Array.isArray(row.crm_companies) ? row.crm_companies[0] || null : row.crm_companies || null,
    })) as Contact[];

    setContacts(nextContacts);
    setCompanies((companyRes.data || []) as Company[]);

    if (nextContacts.length) {
      const { data: linked } = await supabase
        .from("crm_email_threads")
        .select("contact_id")
        .eq("organisation_id", organisation.id)
        .not("contact_id", "is", null);
      const counts: Record<string, number> = {};
      for (const row of linked || []) counts[String(row.contact_id)] = (counts[String(row.contact_id)] || 0) + 1;
      setThreadCounts(counts);
    } else {
      setThreadCounts({});
    }
  }, [organisation?.id, flash]);

  useEffect(() => { loadData(); }, [loadData]);

  const sources = useMemo(() => [...new Set(contacts.map((c) => c.source).filter(Boolean))].sort(), [contacts]);
  const statuses = useMemo(() => [...new Set(contacts.map((c) => c.status).filter(Boolean))].sort(), [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = contacts.filter((contact) => {
      if (companyFilter && contact.company_id !== companyFilter) return false;
      if (sourceFilter && contact.source !== sourceFilter) return false;
      if (statusFilter && contact.status !== statusFilter) return false;
      if (!q) return true;
      return [contact.display_name, contact.email, contact.phone, contact.job_title, contact.company?.name, contact.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });

    return [...rows].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "name") { av = (a.display_name || a.email).toLowerCase(); bv = (b.display_name || b.email).toLowerCase(); }
      if (sortKey === "company") { av = (a.company?.name || "").toLowerCase(); bv = (b.company?.name || "").toLowerCase(); }
      if (sortKey === "last_contacted") { av = a.last_contacted_at || ""; bv = b.last_contacted_at || ""; }
      if (sortKey === "threads") { av = threadCounts[a.id] || 0; bv = threadCounts[b.id] || 0; }
      if (sortKey === "updated") { av = a.updated_at || a.created_at || ""; bv = b.updated_at || b.created_at || ""; }
      const result = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? result : -result;
    });
  }, [contacts, query, companyFilter, sourceFilter, statusFilter, sortKey, sortDir, threadCounts]);

  function toggleColumn(id: ColumnKey) {
    setColumns((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function clearFilters() {
    setQuery(""); setCompanyFilter(""); setSourceFilter(""); setStatusFilter("");
  }

  async function createContact() {
    if (!organisation?.id || !profile?.user_id || !canManage) return;
    if (!email.trim()) return flash("Email is required");
    setSaving(true);

    const { error } = await supabase.from("crm_contacts").insert({
      organisation_id: organisation.id,
      company_id: companyId || null,
      display_name: name.trim() || null,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      job_title: jobTitle.trim() || null,
      status: "active",
      source: "manual",
      created_by: profile.user_id,
    });

    if (error) { setSaving(false); return flash(error.message); }

    setName(""); setEmail(""); setPhone(""); setJobTitle(""); setCompanyId("");
    setFormOpen(false); setSaving(false);
    await loadData();
    flash("Contact added");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="revenue"
        eyebrow="CRM & communication"
        title="Contacts"
        desc="Search, filter, sort and work with contacts created from live email and CRM activity."
        actions={canManage ? (
          <Btn variant="primary" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add contact
          </Btn>
        ) : null}
      />

      <Panel>
        <PanelHead title={`Contacts (${filtered.length.toLocaleString()})`} hint={`${contacts.length.toLocaleString()} total CRM contacts`} />

        <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_190px_170px_160px_170px_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, company, title…"
              className="h-10 w-full rounded-xl border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>

          <DropdownSelect
            value={companyFilter}
            onChange={setCompanyFilter}
            ariaLabel="Company filter"
            placeholder="All companies"
            options={[{ value: "", label: "All companies" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <DropdownSelect
            value={sourceFilter}
            onChange={setSourceFilter}
            ariaLabel="Source filter"
            placeholder="All sources"
            options={[{ value: "", label: "All sources" }, ...sources.map((v) => ({ value: v, label: v }))]}
          />
          <DropdownSelect
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Status filter"
            placeholder="All statuses"
            options={[{ value: "", label: "All statuses" }, ...statuses.map((v) => ({ value: v, label: v }))]}
          />
          <DropdownSelect
            value={sortKey}
            onChange={setSortKey}
            ariaLabel="Sort contacts"
            placeholder="Sort by"
            options={[
              { value: "updated", label: "Recently added" },
              { value: "name", label: "Name" },
              { value: "company", label: "Company" },
              { value: "last_contacted", label: "Last contacted" },
              { value: "threads", label: "Email threads" },
            ]}
          />

          <Btn variant="outline" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
            {sortDir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
            {sortDir === "asc" ? "Asc" : "Desc"}
          </Btn>

          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium">
              <Columns3 className="h-4 w-4" /> Columns
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl">
              {ALL_COLUMNS.map((col) => (
                <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-raised">
                  <input type="checkbox" checked={columns.includes(col.id)} onChange={() => toggleColumn(col.id)} />
                  {col.label}
                </label>
              ))}
            </div>
          </details>
        </div>

        {(query || companyFilter || sourceFilter || statusFilter) ? (
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters active
            <button onClick={clearFilters} className="font-medium text-primary hover:underline">Clear all</button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50 text-xs text-muted-foreground">
                {columns.includes("name") && <th className="px-4 py-3 text-left font-medium">Name</th>}
                {columns.includes("email") && <th className="px-4 py-3 text-left font-medium">Email</th>}
                {columns.includes("phone") && <th className="px-4 py-3 text-left font-medium">Phone</th>}
                {columns.includes("company") && <th className="px-4 py-3 text-left font-medium">Company</th>}
                {columns.includes("job_title") && <th className="px-4 py-3 text-left font-medium">Job title</th>}
                {columns.includes("source") && <th className="px-4 py-3 text-left font-medium">Source</th>}
                {columns.includes("last_contacted") && <th className="px-4 py-3 text-left font-medium">Last contacted</th>}
                {columns.includes("threads") && <th className="px-4 py-3 text-right font-medium">Email threads</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={columns.length || 1} className="px-4 py-12 text-center text-muted-foreground">No contacts match the current filters.</td></tr>
              ) : filtered.map((contact) => {
                const displayName = contact.display_name || contact.email;
                return (
                  <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-surface-raised/60">
                    {columns.includes("name") && <td className="px-4 py-3">
                      <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 font-semibold hover:text-primary">
                        <Avatar initials={displayName.slice(0,2).toUpperCase()} size="sm" />
                        <span className="max-w-56 truncate">{displayName}</span>
                      </Link>
                    </td>}
                    {columns.includes("email") && <td className="px-4 py-3"><a className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary" href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5" />{contact.email}</a></td>}
                    {columns.includes("phone") && <td className="px-4 py-3 text-muted-foreground">{contact.phone ? <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Phone className="h-3.5 w-3.5" />{contact.phone}</a> : "—"}</td>}
                    {columns.includes("company") && <td className="px-4 py-3 text-muted-foreground">{contact.company?.name || "—"}</td>}
                    {columns.includes("job_title") && <td className="px-4 py-3 text-muted-foreground">{contact.job_title || "—"}</td>}
                    {columns.includes("source") && <td className="px-4 py-3"><Tag tone={contact.source === "email" || contact.source === "zoho" ? "primary" : "neutral"}>{contact.source}</Tag></td>}
                    {columns.includes("last_contacted") && <td className="px-4 py-3 text-muted-foreground">{fmt(contact.last_contacted_at)}</td>}
                    {columns.includes("threads") && <td className="px-4 py-3 text-right"><Tag tone={threadCounts[contact.id] ? "primary" : "neutral"}>{threadCounts[contact.id] || 0}</Tag></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {formOpen ? (
        <div className="fixed inset-0 z-80 grid place-items-center bg-black/45 p-4" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-border bg-popover shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div><p className="label-tag text-primary">CRM contact</p><h2 className="mt-1 text-lg font-semibold">Add contact</h2></div>
              <button type="button" onClick={() => setFormOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface-raised"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
              <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@company.com" /></Field>
              <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" /></Field>
              <Field label="Job title"><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Head of Operations" /></Field>
              <div className="sm:col-span-2">
                <Field label="Company">
                  <DropdownSelect value={companyId} onChange={setCompanyId} ariaLabel="Company" placeholder="No company" options={[{ value: "", label: "No company" }, ...companies.map((company) => ({ value: company.id, label: company.name }))]} />
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Btn onClick={() => setFormOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={createContact} disabled={!email.trim() || saving}>{saving ? "Saving…" : "Add contact"}</Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
