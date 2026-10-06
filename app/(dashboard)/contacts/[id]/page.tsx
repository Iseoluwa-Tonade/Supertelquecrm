"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, TrendingUp, Building2 } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

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

type ThreadRow = {
  id: string;
  subject: string | null;
  message_count: number;
  last_message_at: string | null;
  board_item_id: string | null;
};

type DealRow = {
  id: string;
  title: string;
  company: string;
  status: string;
  value: number;
};

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, organisation } = useApp();
  const { flash } = useToast();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [contact, setContact] = useState<ContactRow | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDeal, setCreatingDeal] = useState(false);

  const loadData = useCallback(async () => {
    if (!id || !organisation?.id) return;
    setLoading(true);

    const [contactRes, threadRes, dealRes] = await Promise.all([
      supabase
        .from("crm_contacts")
        .select("id,organisation_id,company_id,display_name,email,phone,job_title,status,source,notes,last_contacted_at,crm_companies(id,name)")
        .eq("organisation_id", organisation.id)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("crm_email_threads")
        .select("id,subject,message_count,last_message_at,board_item_id")
        .eq("organisation_id", organisation.id)
        .eq("contact_id", id)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("crm_board_items")
        .select("id,title,company,status,value")
        .eq("organisation_id", organisation.id)
        .eq("primary_contact_id", id)
        .order("created_at", { ascending: false }),
    ]);

    setContact((contactRes.data as ContactRow | null) || null);
    setThreads((threadRes.data || []) as ThreadRow[]);
    setDeals((dealRes.data || []) as DealRow[]);
    setLoading(false);
  }, [id, organisation?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function createDeal() {
    if (!contact || !profile?.user_id || !organisation?.id || !canManage) return;
    setCreatingDeal(true);

    const companyName = contact.crm_companies?.name || contact.email.split("@")[1] || "Contact opportunity";

    const { data, error } = await supabase
      .from("crm_board_items")
      .insert({
        organisation_id: organisation.id,
        company_id: contact.company_id,
        primary_contact_id: contact.id,
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
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      setCreatingDeal(false);
      return flash(error?.message || "Could not create deal");
    }

    await supabase
      .from("crm_email_threads")
      .update({ board_item_id: data.id })
      .eq("organisation_id", organisation.id)
      .eq("contact_id", contact.id)
      .is("board_item_id", null);

    setCreatingDeal(false);
    router.push("/pipeline/" + data.id);
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading contact…</div>;
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="CRM contact" title="Contact not found" />
        <Link href="/contacts"><Btn><ArrowLeft className="h-4 w-4" /> Back to contacts</Btn></Link>
      </div>
    );
  }

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
        actions={
          canManage ? (
            <Btn variant="primary" size="sm" onClick={createDeal} disabled={creatingDeal}>
              <TrendingUp className="h-4 w-4" />
              {creatingDeal ? "Creating…" : "Create pipeline deal"}
            </Btn>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHead title="Contact details" />
            <div className="space-y-3 p-4 text-sm">
              <a href={"mailto:" + contact.email} className="flex items-center gap-2 text-primary hover:underline">
                <Mail className="h-4 w-4" /> {contact.email}
              </a>
              {contact.phone ? (
                <a href={"tel:" + contact.phone} className="flex items-center gap-2 text-foreground hover:text-primary">
                  <Phone className="h-4 w-4" /> {contact.phone}
                </a>
              ) : null}
              {contact.crm_companies ? (
                <Link href={"/clients/" + contact.crm_companies.id} className="flex items-center gap-2 text-foreground hover:text-primary">
                  <Building2 className="h-4 w-4" /> {contact.crm_companies.name}
                </Link>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <Tag tone="neutral">{contact.source}</Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last contacted</span>
                <span>{fmt(contact.last_contacted_at)}</span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead title={"Pipeline (" + deals.length + ")"} />
            <div className="divide-y divide-border">
              {deals.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No linked deals yet.</div>
              ) : deals.map((deal) => (
                <Link key={deal.id} href={"/pipeline/" + deal.id} className="block p-4 transition-colors hover:bg-surface-raised">
                  <p className="text-sm font-semibold">{deal.title}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{deal.status}</span>
                    <span className="num">{Number(deal.value || 0).toLocaleString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHead title={"Email conversations (" + threads.length + ")"} hint="Automatically linked by email address" />
          <div className="divide-y divide-border">
            {threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No imported Zoho conversations match this contact yet.
              </div>
            ) : threads.map((thread) => (
              <Link key={thread.id} href={"/emails/" + thread.id} className="block px-4 py-4 transition-colors hover:bg-surface-raised">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{thread.subject || "(no subject)"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{thread.message_count} message{thread.message_count === 1 ? "" : "s"}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{fmt(thread.last_message_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
