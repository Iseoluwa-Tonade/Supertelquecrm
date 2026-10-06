"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Inbox, Send, Archive, Bell, ShieldAlert, Search, RefreshCw, Mail, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type ThreadSummary = {
  id: string;
  organisation_id: string;
  subject: string | null;
  last_message_at: string | null;
  message_count: number;
  folder_name: string | null;
  mailbox_category: string | null;
  direction: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string[];
  summary: string | null;
  has_attachments: boolean;
  unread_count: number;
  provider_account_id: string | null;
  mailbox_address: string | null;
  mailbox_display_name: string | null;
};

type EmailAccount = {
  id: string;
  provider: string;
  provider_account_id: string;
  mailbox_address: string;
  primary_email: string | null;
  display_name: string | null;
  status: string;
  is_default: boolean;
};

const CATEGORIES = [
  { id: "", label: "All", icon: Mail },
  { id: "Inbox", label: "Inbox", icon: Inbox },
  { id: "Sent", label: "Sent", icon: Send },
  { id: "Drafts", label: "Drafts", icon: FileText },
  { id: "Archive", label: "Archive", icon: Archive },
  { id: "Updates", label: "Updates", icon: Bell },
  { id: "Mailivery", label: "Mailivery", icon: Mail },
  { id: "Spam & Trash", label: "Spam & Trash", icon: ShieldAlert },
];

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

function peer(thread: ThreadSummary) {
  if (thread.direction === "outbound") return thread.to_addresses?.[0] || "Outbound conversation";
  return thread.from_name || thread.from_address || "Unknown sender";
}

export default function EmailsPage() {
  const router = useRouter();
  const { organisation } = useApp();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 50;

  const loadAccounts = useCallback(async () => {
    if (!organisation?.id) return;
    const { data } = await supabase
      .from("crm_email_accounts")
      .select("id,provider,provider_account_id,mailbox_address,primary_email,display_name,status,is_default")
      .eq("organisation_id", organisation.id)
      .order("is_default", { ascending: false })
      .order("mailbox_address");
    setAccounts((data || []) as EmailAccount[]);
  }, [organisation?.id]);

  const loadCounts = useCallback(async () => {
    if (!organisation?.id) return;

    const results = await Promise.all(
      CATEGORIES.map(async (item) => {
        let request = supabase
          .from("crm_email_thread_summaries")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", organisation.id);

        if (accountId) request = request.eq("provider_account_id", accountId);
        if (item.id) request = request.eq("mailbox_category", item.id);
        const { count } = await request;
        return [item.id || "All", count || 0] as const;
      })
    );

    setCounts(Object.fromEntries(results));
  }, [organisation?.id, accountId]);

  const loadThreads = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);

    let request = supabase
      .from("crm_email_thread_summaries")
      .select("*", { count: "exact" })
      .eq("organisation_id", organisation.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (accountId) request = request.eq("provider_account_id", accountId);
    if (category) request = request.eq("mailbox_category", category);

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
      setThreads((data || []) as ThreadSummary[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [organisation?.id, accountId, category, activeQuery, offset]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadThreads(); }, [loadThreads]);

  const page = Math.floor(offset / pageSize) + 1;
  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <div className="space-y-6">
      <PageHeader
        variant="revenue"
        eyebrow="Communications"
        title="Email"
        desc="Conversation-first mailbox across all connected email accounts."
        actions={
          <Btn
            variant="outline"
            size="sm"
            onClick={() => { loadAccounts(); loadCounts(); loadThreads(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Btn>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {CATEGORIES.map((item, index) => {
          const active = category === item.id;
          const Icon = item.icon;
          const count = counts[item.id || "All"] || 0;

          return (
            <motion.button
              key={item.label}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.28 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCategory(item.id);
                setOffset(0);
              }}
              className={`rounded-2xl border p-4 text-left transition-shadow ${active
                ? "border-primary/50 bg-primary/10 shadow-sm"
                : "border-border bg-surface hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-surface-raised text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="num text-lg font-semibold">{count.toLocaleString()}</span>
              </div>
              <p className="mt-3 text-xs font-medium text-foreground">{item.label}</p>
            </motion.button>
          );
        })}
      </div>

      <Panel>
        <PanelHead
          title={category ? category + " conversations" : "All conversations"}
          hint={total.toLocaleString() + " threads"}
          action={<Tag tone="success">Threaded</Tag>}
        />

        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row">
          <select
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              setOffset(0);
            }}
            className="h-10 rounded-xl border border-border bg-input px-3 text-sm lg:w-64"
          >
            <option value="">All connected mailboxes</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.provider_account_id}>
                {account.display_name ? account.display_name + " — " : ""}{account.mailbox_address}
              </option>
            ))}
          </select>
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

          {(activeQuery || category || accountId) && (
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setActiveQuery("");
                setCategory("");
                setAccountId("");
                setOffset(0);
              }}
            >
              Clear filters
            </Btn>
          )}
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading conversations…</div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No matching conversations found.</div>
          ) : threads.map((thread, index) => (
            <motion.button
              key={thread.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.015, 0.25), duration: 0.22 }}
              onClick={() => router.push(`/emails/${thread.id}`)}
              className="group block w-full px-4 py-4 text-left transition-colors hover:bg-surface-raised/70"
            >
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_150px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{peer(thread)}</p>
                  <p className="truncate text-xs text-muted-foreground">{thread.from_address || thread.direction || "Conversation"}</p>
                  {thread.mailbox_address ? <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">Mailbox: {thread.mailbox_address}</p> : null}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{thread.subject || "(no subject)"}</p>
                    {thread.message_count > 1 && <Tag tone="primary">{thread.message_count} msgs</Tag>}
                    {thread.unread_count > 0 && <Tag tone="warning">{thread.unread_count} unread</Tag>}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground transition-all group-hover:line-clamp-4">{thread.summary || "No preview available."}</p>
                </div>

                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <Tag tone={thread.mailbox_category === "Inbox" ? "primary" : thread.mailbox_category === "Sent" ? "success" : "neutral"}>
                    {thread.mailbox_category || "Other"}
                  </Tag>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{fmt(thread.last_message_at)}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <Btn size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</Btn>
            <Btn size="sm" variant="outline" disabled={offset + pageSize >= total || loading} onClick={() => setOffset(offset + pageSize)}>Next</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}
