"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Mail, RefreshCw, Server, CheckCircle2, AlertCircle } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type SyncState = {
  provider: string;
  provider_account_id: string;
  last_sync_at: string | null;
  status: string;
  last_error: string | null;
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
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [emailCount, setEmailCount] = useState(0);
  const [threadCount, setThreadCount] = useState(0);
  const [databaseHealthy, setDatabaseHealthy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);

    const [syncRes, emailRes, threadRes, dbRes] = await Promise.all([
      supabase
        .from("crm_email_sync_state")
        .select("provider,provider_account_id,last_sync_at,status,last_error")
        .eq("organisation_id", organisation.id)
        .eq("provider", "zoho")
        .maybeSingle(),
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

    setSyncState((syncRes.data as SyncState | null) || null);
    setEmailCount(emailRes.count || 0);
    setThreadCount(threadRes.count || 0);
    setDatabaseHealthy(Boolean(dbRes.data?.id));
    setLoading(false);
  }, [organisation?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const zohoConnected = Boolean(syncState);
  const productionConnected = typeof window !== "undefined" && window.location.hostname === "crm.supertelque.com";

  const cards = [
    {
      title: "Supabase Database",
      icon: Database,
      connected: databaseHealthy,
      detail: databaseHealthy ? "crm-project-board is responding" : "Database check failed",
      meta: "Primary CRM database",
    },
    {
      title: "Zoho Mail",
      icon: Mail,
      connected: zohoConnected,
      detail: zohoConnected ? `${emailCount.toLocaleString()} emails · ${threadCount.toLocaleString()} threads` : "No Zoho sync state found",
      meta: zohoConnected ? `Last sync: ${fmt(syncState?.last_sync_at)}` : "Email archive unavailable",
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
        desc="Live status of the systems currently connected to this CRM."
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
              {card.connected ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              <span>{card.meta}</span>
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHead title="Connection model" hint="One CRM, one database, shared workflows" />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Zoho Mail → CRM</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Imported conversations are threaded, searchable and can create or link revenue pipeline deals.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">CRM → Supabase</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Contacts, companies, deals, projects, tasks, messages and documents share the same organisation-scoped database.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Vercel → CRM UI</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The production application is deployed as the single interface at crm.supertelque.com.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
