"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Mail, RefreshCw, Server, CheckCircle2, AlertCircle } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type EmailAccount = {
  id: string;
  provider: string;
  provider_account_id: string;
  mailbox_address: string;
  primary_email: string | null;
  display_name: string | null;
  aliases: string[];
  status: string;
  is_default: boolean;
  last_sync_at: string | null;
};

function fmt(value?: string | null) {
  if (!value) return "Not synced yet";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConnectionsPage() {
  const { organisation } = useApp();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [emailCount, setEmailCount] = useState(0);
  const [threadCount, setThreadCount] = useState(0);
  const [databaseHealthy, setDatabaseHealthy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);

    const [accountRes, emailRes, threadRes, dbRes] = await Promise.all([
      supabase
        .from("crm_email_accounts")
        .select("id,provider,provider_account_id,mailbox_address,primary_email,display_name,aliases,status,is_default,last_sync_at")
        .eq("organisation_id", organisation.id)
        .order("is_default", { ascending: false })
        .order("mailbox_address"),
      supabase
        .from("crm_emails")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisation.id),
      supabase
        .from("crm_email_threads")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisation.id),
      supabase
        .from("organisations")
        .select("id")
        .eq("id", organisation.id)
        .maybeSingle(),
    ]);

    setAccounts((accountRes.data || []) as EmailAccount[]);
    setEmailCount(emailRes.count || 0);
    setThreadCount(threadRes.count || 0);
    setDatabaseHealthy(Boolean(dbRes.data?.id));
    setLoading(false);
  }, [organisation?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const productionConnected = typeof window !== "undefined" && window.location.hostname === "crm.supertelque.com";

  const cards = [
    {
      title: "Supabase Database",
      icon: Database,
      connected: databaseHealthy,
      detail: databaseHealthy ? "Primary CRM database is responding" : "Database check failed",
      meta: "Live organisation-scoped data",
    },
    {
      title: "Email",
      icon: Mail,
      connected: accounts.some((account) => account.status === "connected"),
      detail: `${accounts.length} mailbox${accounts.length === 1 ? "" : "es"} · ${emailCount.toLocaleString()} emails`,
      meta: `${threadCount.toLocaleString()} conversation threads`,
    },
    {
      title: "Production App",
      icon: Server,
      connected: productionConnected,
      detail: productionConnected ? "crm.supertelque.com" : "Preview / alternate deployment",
      meta: "Vercel production application",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        variant="operations"
        eyebrow="Workspace"
        title="Connections"
        desc="Live status of systems and email accounts connected to this CRM."
        actions={
          <Btn variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Btn>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Panel key={card.title} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <card.icon className="h-5 w-5" />
              </span>
              <Tag tone={card.connected ? "success" : "danger"}>
                {card.connected ? "Connected" : "Attention"}
              </Tag>
            </div>
            <h2 className="mt-4 text-base font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              {card.connected ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
              <span>{card.meta}</span>
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHead title={`Connected mailboxes (${accounts.length})`} hint="Each account keeps its own provider identity and sync state" />
        <div className="divide-y divide-border">
          {accounts.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No email accounts are registered yet.</div>
          ) : accounts.map((account) => (
            <div key={account.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_180px_180px] md:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{account.display_name || account.mailbox_address}</p>
                  {account.is_default ? <Tag tone="primary">Default</Tag> : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{account.mailbox_address}</p>
                {account.aliases?.length ? <p className="mt-1 text-[11px] text-muted-foreground">Aliases: {account.aliases.join(", ")}</p> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{account.provider.toUpperCase()}</p>
                <p>{account.status}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Last sync</p>
                <p className="mt-0.5 text-foreground">{fmt(account.last_sync_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Connection model" hint="One CRM, one database, multiple mailboxes" />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Email → CRM</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Each mailbox is stored separately while contacts, companies and pipeline links remain shared.</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">CRM → Supabase</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">All live records are organisation-scoped and protected by role-based RLS.</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Vercel → CRM UI</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">The production application remains the single interface at crm.supertelque.com.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
