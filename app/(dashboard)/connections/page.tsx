"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Copy,
  Database,
  Link2,
  Mail,
  Plug,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import {
  Btn,
  DropdownSelect,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelHead,
  Tag,
} from "@/components/kit.launchpad";

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

type McpConnection = {
  id: string;
  name: string;
  provider: string;
  server_url: string;
  auth_type: string;
  status: string;
  tools_cache: Array<{ name?: string; description?: string }>;
  last_connected_at: string | null;
  last_error: string | null;
};

function fmt(value?: string | null) {
  if (!value) return "Not connected yet";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConnectionsPage() {
  const { organisation, profile } = useApp();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [mcpConnections, setMcpConnections] = useState<McpConnection[]>([]);
  const [emailCount, setEmailCount] = useState(0);
  const [threadCount, setThreadCount] = useState(0);
  const [databaseHealthy, setDatabaseHealthy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState("");
  const [syncingMail, setSyncingMail] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [provider, setProvider] = useState("custom");
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [authType, setAuthType] = useState("oauth");
  const [bearerToken, setBearerToken] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);

    const [accountRes, emailRes, threadRes, dbRes, mcpRes] = await Promise.all([
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
      canManage ? fetch("/api/mcp/connections", { cache: "no-store" }) : Promise.resolve(null),
    ]);

    setAccounts((accountRes.data || []) as EmailAccount[]);
    setEmailCount(emailRes.count || 0);
    setThreadCount(threadRes.count || 0);
    setDatabaseHealthy(Boolean(dbRes.data?.id));

    if (mcpRes?.ok) {
      const json = await mcpRes.json();
      setMcpConnections(json.connections || []);
    }

    setLoading(false);
  }, [organisation?.id, canManage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("mcp");
    const reason = params.get("reason");
    if (state === "connected") setMessage("MCP connection authorized successfully.");
    if (state === "error") setMessage(`MCP connection failed: ${reason || "Unknown error"}`);
  }, []);

  const productionConnected =
    typeof window !== "undefined" && window.location.hostname === "crm.supertelque.com";
  const crmMcpUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "https://crm.supertelque.com/api/mcp";

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
      title: "MCP Hub",
      icon: Bot,
      connected: true,
      detail: `${mcpConnections.filter((row) => row.status === "connected").length} external MCP connection${mcpConnections.filter((row) => row.status === "connected").length === 1 ? "" : "s"}`,
      meta: "CRM MCP endpoint is installed",
    },
    {
      title: "Production App",
      icon: Server,
      connected: productionConnected,
      detail: productionConnected ? "crm.supertelque.com" : "Preview / alternate deployment",
      meta: "Vercel production application",
    },
  ];

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }

  async function startConnection(input: {
    name: string;
    provider: string;
    server_url?: string;
    auth_type?: string;
    bearer_token?: string;
  }) {
    setConnecting(input.provider || input.name);
    setMessage("");

    try {
      const response = await fetch("/api/mcp/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Connection failed");

      if (json.authorization_url) {
        window.location.href = json.authorization_url;
        return;
      }

      setMessage("MCP server connected.");
      setFormOpen(false);
      setBearerToken("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setConnecting("");
    }
  }

  async function refreshTools(connection: McpConnection) {
    setConnecting(connection.id);
    setMessage("");
    try {
      const response = await fetch(`/api/mcp/connections/${connection.id}/tools`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load tools");
      setMessage(`${json.tools?.length || 0} tools discovered from ${connection.name}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tool discovery failed");
    } finally {
      setConnecting("");
    }
  }

  async function syncMailNow() {
    setSyncingMail(true);
    setMessage("");
    try {
      const response = await fetch("/api/email-sync/mcp", { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Email sync failed");
      const totals = (json.results || []).reduce(
        (acc: { newEmails: number; analyzed: number }, row: any) => {
          const accountRows = Array.isArray(row.accounts) ? row.accounts : [];
          return {
            newEmails: acc.newEmails + accountRows.reduce((sum: number, item: any) => sum + Number(item.new_emails || 0), 0),
            analyzed: acc.analyzed + accountRows.reduce((sum: number, item: any) => sum + Number(item.ai?.analyzed || 0), 0),
          };
        },
        { newEmails: 0, analyzed: 0 },
      );
      setMessage(`Mail sync complete. ${totals.newEmails} new email${totals.newEmails === 1 ? "" : "s"} pulled; ${totals.analyzed} thread${totals.analyzed === 1 ? "" : "s"} analyzed by AI.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email sync failed");
    } finally {
      setSyncingMail(false);
    }
  }

  async function removeConnection(connection: McpConnection) {
    if (!confirm(`Disconnect ${connection.name}?`)) return;
    const response = await fetch(`/api/mcp/connections?id=${encodeURIComponent(connection.id)}`, {
      method: "DELETE",
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error || "Could not disconnect MCP server.");
      return;
    }
    setMessage(`${connection.name} disconnected.`);
    await refresh();
  }

  function openCustom(nextProvider: string) {
    setProvider(nextProvider);
    setName(nextProvider === "zoho" ? "Zoho Mail MCP" : "");
    setServerUrl(nextProvider === "zoho" ? "" : "");
    setAuthType("oauth");
    setBearerToken("");
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="operations"
        eyebrow="Workspace"
        title="Connections"
        desc="Live systems, mailboxes, and Model Context Protocol connections for this CRM."
        actions={
          <div className="flex gap-2">
            {canManage && mcpConnections.some((connection) => connection.provider === "zoho" && connection.status === "connected") ? (
              <Btn variant="primary" size="sm" onClick={syncMailNow} disabled={syncingMail}>
                <Mail className="h-4 w-4" />
                {syncingMail ? "Syncing mail…" : "Sync mail now"}
              </Btn>
            ) : null}
            <Btn variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Btn>
          </div>
        }
      />

      {message ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <PanelHead
          title="Connect ChatGPT to this CRM"
          hint="Supertelque CRM is now an MCP server"
        />
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-medium">CRM MCP server URL</p>
            <div className="mt-2 flex gap-2">
              <Input value={crmMcpUrl} readOnly />
              <Btn variant="outline" onClick={() => copy(crmMcpUrl)}>
                <Copy className="h-4 w-4" />
                Copy
              </Btn>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Connect this URL as a custom MCP server in ChatGPT. Authentication is designed to use your existing Supabase CRM account, so ChatGPT receives only the permissions of the user who authorizes it.
            </p>
          </div>
          <Tag tone="success">MCP endpoint installed</Tag>
        </div>
      </Panel>

      {canManage ? (
        <Panel>
          <PanelHead
            title="External MCP servers"
            hint="Use Clay, Zoho Mail, or another remote MCP from inside the CRM"
            action={
              <Btn variant="outline" size="sm" onClick={() => openCustom("custom")}>
                <Plug className="h-4 w-4" />
                Add MCP
              </Btn>
            }
          />

          <div className="grid gap-3 border-b border-border p-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                startConnection({
                  name: "Clay MCP",
                  provider: "clay",
                  server_url: "https://api.clay.com/v3/mcp",
                  auth_type: "oauth",
                })
              }
              disabled={Boolean(connecting)}
              className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary/50 hover:bg-surface-raised disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Clay MCP</p>
                  <p className="mt-1 text-xs text-muted-foreground">Find/enrich people and companies and run enabled Clay Functions.</p>
                </div>
                <Link2 className="h-5 w-5 text-primary" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => openCustom("zoho")}
              disabled={Boolean(connecting)}
              className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary/50 hover:bg-surface-raised disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Zoho Mail MCP</p>
                  <p className="mt-1 text-xs text-muted-foreground">Paste the secure MCP URL generated in your Zoho MCP console.</p>
                </div>
                <Mail className="h-5 w-5 text-primary" />
              </div>
            </button>
          </div>

          {formOpen ? (
            <form
              className="grid gap-3 border-b border-border p-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                startConnection({
                  name: name || (provider === "zoho" ? "Zoho Mail MCP" : "Custom MCP"),
                  provider,
                  server_url: serverUrl,
                  auth_type: authType,
                  bearer_token: authType === "bearer" ? bearerToken : undefined,
                });
              }}
            >
              <Field label="Connection name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zoho Mail MCP" />
              </Field>
              <DropdownSelect
                value={provider}
                onChange={setProvider}
                ariaLabel="MCP provider"
                placeholder="Choose provider"
                options={[
                  { value: "custom", label: "Custom MCP" },
                  { value: "zoho", label: "Zoho Mail" },
                  { value: "clay", label: "Clay" },
                ]}
              />
              <div className="md:col-span-2">
                <Field label="MCP server URL">
                  <Input
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder={provider === "zoho" ? "Paste the URL from Zoho MCP Console" : "https://example.com/mcp"}
                    required
                  />
                </Field>
              </div>
              <DropdownSelect
                value={authType}
                onChange={setAuthType}
                ariaLabel="Authentication"
                placeholder="Choose authentication"
                options={[
                  { value: "oauth", label: "OAuth (recommended)" },
                  { value: "bearer", label: "Bearer token" },
                  { value: "none", label: "No authentication" },
                ]}
              />
              {authType === "bearer" ? (
                <Field label="Bearer token">
                  <Input type="password" value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} required />
                </Field>
              ) : (
                <div />
              )}
              <div className="md:col-span-2 flex justify-end gap-2">
                <Btn type="button" onClick={() => setFormOpen(false)}>Cancel</Btn>
                <Btn type="submit" variant="primary" disabled={Boolean(connecting)}>
                  {connecting ? "Connecting..." : "Connect MCP"}
                </Btn>
              </div>
            </form>
          ) : null}

          <div className="divide-y divide-border">
            {mcpConnections.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No external MCP servers connected yet.</div>
            ) : (
              mcpConnections.map((connection) => (
                <div key={connection.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_150px_130px_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{connection.name}</p>
                      <Tag tone={connection.status === "connected" ? "success" : connection.status === "attention" ? "warning" : "neutral"}>
                        {connection.status}
                      </Tag>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{connection.server_url}</p>
                    {connection.last_error ? <p className="mt-1 text-xs text-destructive">{connection.last_error}</p> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{connection.provider.toUpperCase()}</p>
                    <p>{connection.auth_type}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>{connection.tools_cache?.length || 0} tools</p>
                    <p>{fmt(connection.last_connected_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => refreshTools(connection)}
                      disabled={connecting === connection.id}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${connecting === connection.id ? "animate-spin" : ""}`} />
                      Tools
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => removeConnection(connection)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Btn>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      ) : null}

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
    </div>
  );
}
