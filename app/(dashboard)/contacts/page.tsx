"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Columns3, Mail, Phone, Plus, Search, SlidersHorizontal, X } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Avatar, Btn, Field, Input, PageHeader, Panel, PanelHead, Tag, DropdownSelect } from "@/components/kit.launchpad";

const supabase = createClient();

type Company = {
  id: string;
  name: string;
};

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

type ColumnId =
  | "contact"
  | "company"
  | "email"
  | "phone"
  | "job_title"
  | "status"
  | "source"
  | "threads"
  | "last_contacted";

const COLUMN_LABELS: Record<ColumnId, string> = {
  contact: "Contact",
  company: "Company",
  email: "Email",
  phone: "Phone",
  job_title: "Job title",
  status: "Status",
  source: "Source",
  threads: "Email threads",
  last_contacted: "Last contacted",
};

const DEFAULT_COLUMNS: ColumnId[] = ["contact","company","email","job_title","threads","last_contacted"];

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export default function ContactsPage() {
  const { profile, organisation } = useApp();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyId, setCompanyId] = useState("");

  const loadData = useCallback(async () => {
    if (!organisation?.id) return;

    const [contactRes, companyRes, threadRes] = await Promise.all([
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
      supabase
        .from("crm_email_threads")
        .select("contact_id")
        .eq("organisation_id", organisation.id)
        .not("contact_id", "is", null),
    ]);

    const nextContacts = (contactRes.data || []).map((row: any) => ({
      ...row,
      company: Array.isArray(row.crm_companies) ? row.crm_companies[0] || null : row.crm_companies || null,
    })) as Contact[];

    setContacts(nextContacts);
    setCompanies((companyRes.data || []) as Company[]);

    const counts: Record<string, number> = {};
    for (const row of threadRes.data || []) {
      const id = String((row as any).contact_id || "");
      if (id) counts[id] = (counts[id] || 0) + 1;
    }
    setThreadCounts(counts);
  }, [organisation?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const statuses = useMemo(() => [...new Set(contacts.map((contact) => contact.status).filter(Boolean))].sort(), [contacts]);
  const sources = useMemo(() => [...new Set(contacts.map((contact) => contact.source).filter(Boolean))].sort(), [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = contacts.filter((contact) => {
      const matchesQuery = !q || [
        contact.display_name,
        contact.email,
        contact.phone,
        contact.job_title,
        contact.company?.name,
        contact.status,
        contact.source,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));

      return matchesQuery
        && (!companyFilter || contact.company_id === companyFilter)
        && (!statusFilter || contact.status === statusFilter)
        && (!sourceFilter || contact.source === sourceFilter);
    });

    return [...rows].sort((a, b) => {
      if (sort === "name_asc") return (a.display_name || a.email).localeCompare(b.display_name || b.email);
      if (sort === "name_desc") return (b.display_name || b.email).localeCompare(a.display_name || a.email);
      if (sort === "threads_desc") return (threadCounts[b.id] || 0) - (threadCounts[a.id] || 0);
      if (sort === "last_contacted_desc") return new Date(b.last_contacted_at || 0).getTime() - new Date(a.last_contacted_at || 0).getTime();
      if (sort === "created_desc") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [contacts, query, companyFilter, statusFilter, sourceFilter, sort, threadCounts]);

  function toggleColumn(column: ColumnId) {
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        if (column === "contact") return current;
        return current.filter((item) => item !== column);
      }
      return [...current, column];
    });
  }

  function resetView() {
    setQuery("");
    setCompanyFilter("");
    setStatusFilter("");
    setSourceFilter("");
    setSort("updated_desc");
    setVisibleColumns(DEFAULT_COLUMNS);
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

    if (error) {
      setSaving(false);
      return flash(error.message);
    }

    setName("");
    setEmail("");
    setPhone("");
    setJobTitle("");
    setCompanyId("");
    setFormOpen(false);
    setSaving(false);
    await loadData();
    flash("Contact added");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="revenue"
        eyebrow="Revenue"
        title="Contacts"
        desc="External prospects and client contacts connected to email and pipeline activity."
        actions={
          canManage ? (
            <Btn variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Add contact
            </Btn>
          ) : null
        }
      />

      <Panel>
        <PanelHead
          title={"Contacts (" + filtered.length.toLocaleString() + ")"}
          hint="Search, filter, sort and choose the columns you need"
          action={
            <div className="relative">
              <Btn variant="outline" size="sm" onClick={() => setColumnsOpen((open) => !open)}>
                <Columns3 className="h-4 w-4" /> Columns
              </Btn>
              {columnsOpen ? (
                <div className="absolute right-0 top-10 z-40 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl">
                  {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((column) => (
                    <label key={column} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-surface-raised">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column)}
                        disabled={column === "contact"}
                        onChange={() => toggleColumn(column)}
                      />
                      <span>{COLUMN_LABELS[column]}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          }
        />

        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, company, title…"
              className="h-10 w-full rounded-xl border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>

          <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-input px-3 text-sm">
            <option value="">All companies</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-input px-3 text-sm">
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>

          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-input px-3 text-sm">
            <option value="">All sources</option>
            {sources.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>

          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-xl border border-border bg-input px-3 text-sm">
            <option value="updated_desc">Recently updated</option>
            <option value="last_contacted_desc">Recently contacted</option>
            <option value="threads_desc">Most email threads</option>
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
            <option value="created_desc">Newest contacts</option>
          </select>

          <Btn variant="ghost" size="sm" onClick={resetView}>
            <SlidersHorizontal className="h-4 w-4" /> Reset
          </Btn>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/40 text-xs text-muted-foreground">
                {visibleColumns.includes("contact") && <th className="px-4 py-3 text-left font-medium">Contact</th>}
                {visibleColumns.includes("company") && <th className="px-4 py-3 text-left font-medium">Company</th>}
                {visibleColumns.includes("email") && <th className="px-4 py-3 text-left font-medium">Email</th>}
                {visibleColumns.includes("phone") && <th className="px-4 py-3 text-left font-medium">Phone</th>}
                {visibleColumns.includes("job_title") && <th className="px-4 py-3 text-left font-medium">Job title</th>}
                {visibleColumns.includes("status") && <th className="px-4 py-3 text-left font-medium">Status</th>}
                {visibleColumns.includes("source") && <th className="px-4 py-3 text-left font-medium">Source</th>}
                {visibleColumns.includes("threads") && <th className="px-4 py-3 text-right font-medium">Threads</th>}
                {visibleColumns.includes("last_contacted") && <th className="px-4 py-3 text-left font-medium">Last contacted</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No contacts match the current filters.
                  </td>
                </tr>
              ) : filtered.map((contact) => {
                const displayName = contact.display_name || contact.email;
                return (
                  <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-surface-raised/50">
                    {visibleColumns.includes("contact") && (
                      <td className="px-4 py-3">
                        <Link href={"/contacts/" + contact.id} className="flex items-center gap-3 hover:text-primary">
                          <Avatar initials={displayName.slice(0, 2).toUpperCase()} size="sm" />
                          <div className="min-w-0">
                            <p className="max-w-56 truncate font-semibold">{displayName}</p>
                            <p className="text-[11px] text-muted-foreground">Open record</p>
                          </div>
                        </Link>
                      </td>
                    )}
                    {visibleColumns.includes("company") && <td className="px-4 py-3 text-muted-foreground">{contact.company?.name || "—"}</td>}
                    {visibleColumns.includes("email") && (
                      <td className="px-4 py-3">
                        <a href={"mailto:" + contact.email} className="inline-flex max-w-64 items-center gap-1.5 truncate text-muted-foreground hover:text-primary">
                          <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{contact.email}</span>
                        </a>
                      </td>
                    )}
                    {visibleColumns.includes("phone") && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {contact.phone ? <a href={"tel:" + contact.phone} className="inline-flex items-center gap-1.5 hover:text-primary"><Phone className="h-3.5 w-3.5" />{contact.phone}</a> : "—"}
                      </td>
                    )}
                    {visibleColumns.includes("job_title") && <td className="px-4 py-3 text-muted-foreground">{contact.job_title || "—"}</td>}
                    {visibleColumns.includes("status") && <td className="px-4 py-3"><Tag tone={contact.status === "active" ? "success" : "neutral"}>{contact.status}</Tag></td>}
                    {visibleColumns.includes("source") && <td className="px-4 py-3"><Tag tone={contact.source === "email" ? "primary" : "neutral"}>{contact.source}</Tag></td>}
                    {visibleColumns.includes("threads") && <td className="px-4 py-3 text-right num">{threadCounts[contact.id] || 0}</td>}
                    {visibleColumns.includes("last_contacted") && <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmt(contact.last_contacted_at)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {formOpen ? (
        <div className="fixed inset-0 z-80 grid place-items-center bg-black/45 p-4" onClick={() => setFormOpen(false)}>
          <div
            className="w-full max-w-xl rounded-2xl border border-border bg-popover shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="label-tag text-primary">CRM contact</p>
                <h2 className="mt-1 text-lg font-semibold">Add contact</h2>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface-raised"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Name">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Email">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@company.com" />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1…" />
              </Field>
              <Field label="Job title">
                <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Head of Operations" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Company">
                  <DropdownSelect
                    value={companyId}
                    onChange={setCompanyId}
                    ariaLabel="Company"
                    placeholder="No company"
                    options={[
                      { value: "", label: "No company" },
                      ...companies.map((company) => ({ value: company.id, label: company.name })),
                    ]}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Btn onClick={() => setFormOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={createContact} disabled={!email.trim() || saving}>
                {saving ? "Saving…" : "Add contact"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
