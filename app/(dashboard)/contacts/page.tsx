"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Phone, Plus, Search, X } from "lucide-react";

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
  company?: Company | null;
};

export default function ContactsPage() {
  const { profile, organisation } = useApp();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyId, setCompanyId] = useState("");

  const loadData = useCallback(async () => {
    if (!organisation?.id) return;

    const [contactRes, companyRes] = await Promise.all([
      supabase
        .from("crm_contacts")
        .select("id,company_id,display_name,email,phone,job_title,status,source,last_contacted_at,created_at,crm_companies(id,name)")
        .eq("organisation_id", organisation.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("crm_companies")
        .select("id,name")
        .eq("organisation_id", organisation.id)
        .order("name", { ascending: true }),
    ]);

    const nextContacts = (contactRes.data || []).map((row: any) => ({
      ...row,
      company: Array.isArray(row.crm_companies) ? row.crm_companies[0] || null : row.crm_companies || null,
    })) as Contact[];

    setContacts(nextContacts);
    setCompanies((companyRes.data || []) as Company[]);

    if (nextContacts.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(
        nextContacts.map(async (contact) => {
          const { count } = await supabase
            .from("crm_email_threads")
            .select("id", { count: "exact", head: true })
            .eq("organisation_id", organisation.id)
            .eq("contact_id", contact.id);
          counts[contact.id] = count || 0;
        })
      );
      setThreadCounts(counts);
    } else {
      setThreadCounts({});
    }
  }, [organisation?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) =>
      [
        contact.display_name,
        contact.email,
        contact.phone,
        contact.job_title,
        contact.company?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [contacts, query]);

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
          title={`Contacts (${filtered.length})`}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search contacts…"
                className="h-9 w-56 rounded-xl border border-border bg-input pl-8 pr-3 text-xs outline-none focus:border-primary/50"
              />
            </div>
          }
        />

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No contacts yet. {canManage ? "Add the first contact above." : ""}
            </div>
          ) : (
            filtered.map((contact) => {
              const displayName = contact.display_name || contact.email;
              return (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="grid gap-3 px-4 py-4 transition-colors hover:bg-surface-raised/60 md:grid-cols-[minmax(0,1fr)_220px_120px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={displayName.slice(0, 2).toUpperCase()} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.job_title || "Contact"}{contact.company?.name ? ` · ${contact.company.name}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.phone ? (
                      <div className="mt-1 flex items-center gap-1.5 truncate">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{contact.phone}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Tag tone={threadCounts[contact.id] ? "primary" : "neutral"}>
                      {threadCounts[contact.id] || 0} email threads
                    </Tag>
                  </div>
                </Link>
              );
            })
          )}
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
