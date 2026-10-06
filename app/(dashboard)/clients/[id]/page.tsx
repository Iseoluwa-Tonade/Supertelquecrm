"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Contact, Globe2, Mail, Phone, TrendingUp } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type CompanyRow = {
  id: string;
  organisation_id: string;
  name: string;
  domain: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  source: string;
  notes: string;
};

type ContactRow = {
  id: string;
  display_name: string | null;
  email: string;
  job_title: string | null;
};

type DealRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  value: number;
};

type ThreadRow = {
  id: string;
  subject: string | null;
  message_count: number;
  last_message_at: string | null;
};

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const { organisation } = useApp();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [records, setRecords] = useState<DealRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id || !organisation?.id) return;
    setLoading(true);

    const [companyRes, contactRes, recordRes, threadRes] = await Promise.all([
      supabase
        .from("crm_companies")
        .select("id,organisation_id,name,domain,website,phone,address,status,source,notes")
        .eq("organisation_id", organisation.id)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("crm_contacts")
        .select("id,display_name,email,job_title")
        .eq("organisation_id", organisation.id)
        .eq("company_id", id)
        .order("display_name", { ascending: true }),
      supabase
        .from("crm_board_items")
        .select("id,type,title,status,value")
        .eq("organisation_id", organisation.id)
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_email_threads")
        .select("id,subject,message_count,last_message_at")
        .eq("organisation_id", organisation.id)
        .eq("company_id", id)
        .order("last_message_at", { ascending: false })
        .limit(20),
    ]);

    setCompany((companyRes.data as CompanyRow | null) || null);
    setContacts((contactRes.data || []) as ContactRow[]);
    setRecords((recordRes.data || []) as DealRow[]);
    setThreads((threadRes.data || []) as ThreadRow[]);
    setLoading(false);
  }, [id, organisation?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading company…</div>;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="CRM company" title="Company not found" />
        <Link href="/clients"><Btn><ArrowLeft className="h-4 w-4" /> Back to companies</Btn></Link>
      </div>
    );
  }

  const deals = records.filter((record) => record.type === "deal");
  const projects = records.filter((record) => record.type === "project");

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>

      <PageHeader
        variant="revenue"
        eyebrow="CRM company"
        title={company.name}
        desc={company.domain || company.website || "Company record"}
        actions={<Tag tone={company.status === "client" ? "success" : "primary"}>{company.status}</Tag>}
      />

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHead title="Company details" />
            <div className="space-y-3 p-4 text-sm">
              {company.domain ? (
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  <span>{company.domain}</span>
                </div>
              ) : null}
              {company.website ? (
                <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                  <Globe2 className="h-4 w-4" /> {company.website}
                </a>
              ) : null}
              {company.phone ? (
                <a href={"tel:" + company.phone} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="h-4 w-4" /> {company.phone}
                </a>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <Tag tone="neutral">{company.source}</Tag>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead title={"Contacts (" + contacts.length + ")"} />
            <div className="divide-y divide-border">
              {contacts.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No contacts linked yet.</div>
              ) : contacts.map((contact) => (
                <Link key={contact.id} href={"/contacts/" + contact.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-raised">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Contact className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{contact.display_name || contact.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{contact.job_title || contact.email}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHead title={"CRM records (" + records.length + ")"} hint={deals.length + " deals · " + projects.length + " projects"} />
            <div className="divide-y divide-border">
              {records.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No pipeline or project records linked yet.</div>
              ) : records.map((record) => (
                <Link
                  key={record.id}
                  href={record.type === "project" ? "/projects/" + record.id : record.type === "task" ? "/tasks/" + record.id : "/pipeline/" + record.id}
                  className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-raised"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    {record.type === "deal" ? <TrendingUp className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{record.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{record.type} · {record.status}</p>
                  </div>
                  <span className="num text-xs text-muted-foreground">{Number(record.value || 0).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHead title={"Email conversations (" + threads.length + ")"} />
            <div className="divide-y divide-border">
              {threads.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No company email threads linked yet.</div>
              ) : threads.map((thread) => (
                <Link key={thread.id} href={"/emails/" + thread.id} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-raised">
                  <Mail className="h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{thread.subject || "(no subject)"}</p>
                    <p className="text-xs text-muted-foreground">{thread.message_count} messages</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmt(thread.last_message_at)}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
