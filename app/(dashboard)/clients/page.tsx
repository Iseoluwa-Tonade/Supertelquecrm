"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, Globe2, Plus, Search, X } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Btn, Field, Input, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type Company = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  phone: string | null;
  status: string;
  source: string;
  created_at: string;
};

export default function CompaniesPage() {
  const { profile, organisation } = useApp();
  const searchParams = useSearchParams();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [dealCounts, setDealCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q) setQuery(q);
  }, [searchParams]);


  const loadData = useCallback(async () => {
    if (!organisation?.id) return;

    const { data } = await supabase
      .from("crm_companies")
      .select("id,name,domain,website,phone,status,source,created_at")
      .eq("organisation_id", organisation.id)
      .order("updated_at", { ascending: false });

    const nextCompanies = (data || []) as Company[];
    setCompanies(nextCompanies);

    const nextContactCounts: Record<string, number> = {};
    const nextDealCounts: Record<string, number> = {};

    await Promise.all(
      nextCompanies.map(async (company) => {
        const [contacts, deals] = await Promise.all([
          supabase
            .from("crm_contacts")
            .select("id", { count: "exact", head: true })
            .eq("organisation_id", organisation.id)
            .eq("company_id", company.id),
          supabase
            .from("crm_board_items")
            .select("id", { count: "exact", head: true })
            .eq("organisation_id", organisation.id)
            .eq("company_id", company.id),
        ]);

        nextContactCounts[company.id] = contacts.count || 0;
        nextDealCounts[company.id] = deals.count || 0;
      })
    );

    setContactCounts(nextContactCounts);
    setDealCounts(nextDealCounts);
  }, [organisation?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((company) =>
      [company.name, company.domain, company.website]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [companies, query]);

  async function createCompany() {
    if (!organisation?.id || !profile?.user_id || !canManage) return;
    if (!name.trim()) return flash("Company name is required");

    setSaving(true);
    const normalizedDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];

    const { error } = await supabase.from("crm_companies").insert({
      organisation_id: organisation.id,
      name: name.trim(),
      domain: normalizedDomain || null,
      website: website.trim() || (normalizedDomain ? "https://" + normalizedDomain : null),
      phone: phone.trim() || null,
      status: "prospect",
      source: "manual",
      created_by: profile.user_id,
    });

    if (error) {
      setSaving(false);
      return flash(error.message);
    }

    setName("");
    setDomain("");
    setWebsite("");
    setPhone("");
    setFormOpen(false);
    setSaving(false);
    await loadData();
    flash("Company added");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="revenue"
        eyebrow="Revenue"
        title="Companies"
        desc="Prospect and client organisations connected to contacts, deals and email."
        actions={
          canManage ? (
            <Btn variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Add company
            </Btn>
          ) : null
        }
      />

      <Panel>
        <PanelHead
          title={`Companies (${filtered.length})`}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search companies…"
                className="h-9 w-56 rounded-xl border border-border bg-input pl-8 pr-3 text-xs outline-none focus:border-primary/50"
              />
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Contacts</th>
                <th className="px-4 py-3 font-medium">CRM records</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No companies yet. {canManage ? "Add the first company above." : ""}
                  </td>
                </tr>
              ) : filtered.map((company) => (
                <tr key={company.id} className="border-b border-border last:border-0 hover:bg-surface-raised/60">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${company.id}`} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="font-semibold text-foreground">{company.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {company.domain ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Globe2 className="h-3.5 w-3.5" />
                        <span>{company.domain}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{contactCounts[company.id] || 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{dealCounts[company.id] || 0}</td>
                  <td className="px-4 py-3"><Tag tone={company.status === "client" ? "success" : "primary"}>{company.status}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {formOpen ? (
        <div className="fixed inset-0 z-80 grid place-items-center bg-black/45 p-4" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-border bg-popover shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="label-tag text-primary">CRM company</p>
                <h2 className="mt-1 text-lg font-semibold">Add company</h2>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface-raised">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Company name">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme Inc." />
              </Field>
              <Field label="Domain">
                <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="acme.com" />
              </Field>
              <Field label="Website">
                <Input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://acme.com" />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1…" />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Btn onClick={() => setFormOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={createCompany} disabled={!name.trim() || saving}>
                {saving ? "Saving…" : "Add company"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
