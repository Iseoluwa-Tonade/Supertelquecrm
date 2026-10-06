"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Paperclip, RefreshCw, Search, Send, X } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type EmailRow = {
  id: string;
  organisation_id: string;
  thread_id: string | null;
  provider: string;
  provider_account_id: string | null;
  provider_message_id: string;
  provider_thread_id: string | null;
  folder_name: string | null;
  direction: "inbound" | "outbound" | "system";
  from_address: string | null;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  summary: string | null;
  body_text: string | null;
  body_html: string | null;
  sent_at: string | null;
  received_at: string | null;
  is_read: boolean | null;
  has_attachments: boolean;
  created_at: string;
};

const FOLDERS = ["Inbox", "Sent", "Archive", "Newsletter", "Notification", "Mailivery", "Drafts", "Snoozed", "Outbox", "Spam", "Trash"];

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

function peer(email: EmailRow) {
  if (email.direction === "outbound") return email.to_addresses?.[0] || "Outbound";
  return email.from_name || email.from_address || "Unknown sender";
}

export default function EmailsPage() {
  const { organisation } = useApp();
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [inbound, setInbound] = useState(0);
  const [outbound, setOutbound] = useState(0);
  const [threads, setThreads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<EmailRow | null>(null);
  const [threadRows, setThreadRows] = useState<EmailRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const pageSize = 50;

  const loadStats = useCallback(async () => {
    if (!organisation?.id) return;
    const [all, inc, out, th] = await Promise.all([
      supabase.from("crm_emails").select("id", { count: "exact", head: true }).eq("organisation_id", organisation.id),
      supabase.from("crm_emails").select("id", { count: "exact", head: true }).eq("organisation_id", organisation.id).eq("direction", "inbound"),
      supabase.from("crm_emails").select("id", { count: "exact", head: true }).eq("organisation_id", organisation.id).eq("direction", "outbound"),
      supabase.from("crm_email_threads").select("id", { count: "exact", head: true }).eq("organisation_id", organisation.id),
    ]);
    setTotal(all.count || 0);
    setInbound(inc.count || 0);
    setOutbound(out.count || 0);
    setThreads(th.count || 0);
  }, [organisation?.id]);

  const loadRows = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);

    let request = supabase
      .from("crm_emails")
      .select("*", { count: "exact" })
      .eq("organisation_id", organisation.id)
      .order("received_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (folder) request = request.eq("folder_name", folder);
    if (activeQuery) {
      const safe = activeQuery.replace(/[,%()]/g, " ").trim();
      if (safe) {
        request = request.or(
          `subject.ilike.%${safe}%,summary.ilike.%${safe}%,from_address.ilike.%${safe}%,from_name.ilike.%${safe}%`
        );
      }
    }

    const { data, error, count } = await request;
    if (!error) {
      setRows((data || []) as EmailRow[]);
      if (folder || activeQuery) setTotal(count || 0);
    }
    setLoading(false);
  }, [organisation?.id, folder, activeQuery, offset]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function openEmail(email: EmailRow) {
    setSelected(email);
    setThreadLoading(true);

    let request = supabase
      .from("crm_emails")
      .select("*")
      .eq("organisation_id", email.organisation_id);

    request = email.provider_thread_id
      ? request.eq("provider_thread_id", email.provider_thread_id)
      : request.eq("id", email.id);

    const { data } = await request.order("received_at", { ascending: true, nullsFirst: false });
    setThreadRows((data || []) as EmailRow[]);
    setThreadLoading(false);
  }

  const page = Math.floor(offset / pageSize) + 1;
  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <div className="space-y-6">
      <PageHeader
        variant="revenue"
        eyebrow="Communications"
        title="Zoho Email"
        desc="Your imported business mailbox, now inside the CRM."
        actions={
          <Btn variant="outline" size="sm" onClick={() => { loadStats(); loadRows(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Btn>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="p-4"><p className="label-tag text-muted-foreground">Messages</p><p className="num mt-2 text-2xl">{total.toLocaleString()}</p></Panel>
        <Panel className="p-4"><p className="label-tag text-muted-foreground">Threads</p><p className="num mt-2 text-2xl">{threads.toLocaleString()}</p></Panel>
        <Panel className="p-4"><p className="label-tag text-muted-foreground">Inbound</p><p className="num mt-2 text-2xl">{inbound.toLocaleString()}</p></Panel>
        <Panel className="p-4"><p className="label-tag text-muted-foreground">Outbound</p><p className="num mt-2 text-2xl">{outbound.toLocaleString()}</p></Panel>
      </div>

      <Panel>
        <PanelHead title="Mailbox archive" hint="Zoho Mail imported into the Supertelque CRM" action={<Tag tone="success">Connected</Tag>} />

        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row">
          <form
            className="relative flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              setOffset(0);
              setActiveQuery(query.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subject, sender or preview…"
              className="h-10 w-full rounded-xl border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </form>

          <select
            value={folder}
            onChange={(event) => {
              setFolder(event.target.value);
              setOffset(0);
            }}
            className="h-10 w-full lg:w-48"
          >
            <option value="">All folders</option>
            {FOLDERS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>

          {(activeQuery || folder) && (
            <Btn variant="ghost" size="sm" onClick={() => { setQuery(""); setActiveQuery(""); setFolder(""); setOffset(0); }}>
              Clear filters
            </Btn>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-raised/60 text-left">
                <th className="px-4 py-3 text-[11px] uppercase tracking-[.12em] text-muted-foreground">From / To</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-[.12em] text-muted-foreground">Subject</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-[.12em] text-muted-foreground">Folder</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-[.12em] text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading mailbox…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">No matching email found.</td></tr>
              ) : rows.map((email) => (
                <tr key={email.id} onClick={() => openEmail(email)} className="cursor-pointer border-b border-border/70 hover:bg-surface-raised/70">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                        {email.direction === "outbound" ? <Send className="h-3.5 w-3.5" /> : <Inbox className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-56 truncate text-sm font-medium">{peer(email)}</p>
                        <p className="max-w-56 truncate text-xs text-muted-foreground">{email.direction === "outbound" ? "Sent" : email.from_address || "Received"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{email.subject || "(no subject)"}</p>
                      {email.has_attachments ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{email.summary || "No preview available."}</p>
                  </td>
                  <td className="px-4 py-3"><Tag tone={email.folder_name === "Inbox" ? "primary" : email.folder_name === "Sent" ? "success" : "neutral"}>{email.folder_name || "Unknown"}</Tag></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmt(email.received_at || email.sent_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <Btn size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</Btn>
            <Btn size="sm" variant="outline" disabled={offset + pageSize >= total || loading} onClick={() => setOffset(offset + pageSize)}>Next</Btn>
          </div>
        </div>
      </Panel>

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelected(null)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div className="min-w-0">
                <p className="label-tag text-primary">Email conversation</p>
                <h2 className="mt-1 truncate text-lg font-semibold">{selected.subject || "(no subject)"}</h2>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl" onClick={() => setSelected(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {threadLoading ? (
                <p className="text-sm text-muted-foreground">Loading conversation…</p>
              ) : threadRows.map((message) => (
                <article key={message.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{message.from_name || message.from_address || "Unknown sender"}</p>
                      <p className="text-xs text-muted-foreground">To: {(message.to_addresses || []).join(", ") || "—"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmt(message.received_at || message.sent_at)}</span>
                  </div>
                  <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                    {message.body_text || message.summary || "Full body sync is pending."}
                  </div>
                  {message.has_attachments ? <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Paperclip className="h-3.5 w-3.5" />Attachment metadata available</div> : null}
                </article>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
