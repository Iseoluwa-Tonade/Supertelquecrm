"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  ArrowDownAZ,
  ArrowUpAZ,
  Bell,
  Columns3,
  FileText,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Btn, DropdownSelect, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

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

type ColumnKey = "peer" | "subject" | "preview" | "mailbox" | "category" | "direction" | "messages" | "unread" | "date";

const ALL_COLUMNS: Array<{ id: ColumnKey; label: string }> = [
  { id: "peer", label: "Contact" },
  { id: "subject", label: "Subject" },
  { id: "preview", label: "Preview" },
  { id: "mailbox", label: "Mailbox" },
  { id: "category", label: "Folder" },
  { id: "direction", label: "Direction" },
  { id: "messages", label: "Messages" },
  { id: "unread", label: "Unread" },
  { id: "date", label: "Last activity" },
];

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
  const searchParams = useSearchParams();
  const { organisation } = useApp();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [category, setCategory] = useState("");
  const [direction, setDirection] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sortKey, setSortKey] = useState("last_message_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<ColumnKey[]>(["peer","subject","preview","mailbox","category","messages","unread","date"]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 50;

  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q) {
      setQuery(q);
      setActiveQuery(q);
      setOffset(0);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("crm.email.columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setColumns(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("crm.email.columns", JSON.stringify(columns)); } catch {}
  }, [columns]);

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
      .order(sortKey, { ascending: sortDir === "asc", nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (accountId) request = request.eq("provider_account_id", accountId);
    if (category) request = request.eq("mailbox_category", category);
    if (direction) request = request.eq("direction", direction);
    if (unreadOnly) request = request.gt("unread_count", 0);

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
  }, [organisation?.id, accountId, category, direction, unreadOnly, activeQuery, offset, sortKey, sortDir]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadThreads(); }, [loadThreads]);

  const page = Math.floor(offset / pageSize) + 1;
  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  function toggleColumn(id: ColumnKey) {
    setColumns((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function clearFilters() {
    setQuery("");
    setActiveQuery("");
    setCategory("");
    setAccountId("");
    setDirection("");
    setUnreadOnly(false);
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="revenue"
        eyebrow="CRM & communication"
        title="Email"
        desc="Search, filter and sort every conversation across all connected mailboxes."
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
              onClick={() => { setCategory(item.id); setOffset(0); }}
              className={`rounded-2xl border p-4 text-left transition-shadow ${active ? "border-primary/50 bg-primary/10 shadow-sm" : "border-border bg-surface hover:shadow-md"}`}
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
          hint={total.toLocaleString() + " matching threads"}
          action={<Tag tone="success">Threaded</Tag>}
        />

        <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[240px_minmax(260px,1fr)_150px_160px_190px_auto_auto]">
          <select
            value={accountId}
            onChange={(e) => { setAccountId(e.target.value); setOffset(0); }}
            className="h-10 rounded-xl border border-border bg-input px-3 text-sm"
          >
            <option value="">All connected mailboxes</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.provider_account_id}>
                {account.display_name ? account.display_name + " — " : ""}{account.mailbox_address}
              </option>
            ))}
          </select>

          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              setOffset(0);
              setActiveQuery(query.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sender, subject or message preview…"
              className="h-10 w-full rounded-xl border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </form>

          <DropdownSelect
            value={direction}
            onChange={(value) => { setDirection(value); setOffset(0); }}
            ariaLabel="Direction filter"
            placeholder="Any direction"
            options={[
              { value: "", label: "Any direction" },
              { value: "inbound", label: "Inbound" },
              { value: "outbound", label: "Outbound" },
              { value: "system", label: "System" },
            ]}
          />

          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setOffset(0); }} />
            Unread only
          </label>

          <DropdownSelect
            value={sortKey}
            onChange={(value) => { setSortKey(value); setOffset(0); }}
            ariaLabel="Sort email"
            placeholder="Sort by"
            options={[
              { value: "last_message_at", label: "Last activity" },
              { value: "message_count", label: "Message count" },
              { value: "unread_count", label: "Unread count" },
              { value: "subject", label: "Subject" },
              { value: "from_name", label: "Sender name" },
            ]}
          />

          <Btn variant="outline" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
            {sortDir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
            {sortDir === "asc" ? "Asc" : "Desc"}
          </Btn>

          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium">
              <Columns3 className="h-4 w-4" /> Columns
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl">
              {ALL_COLUMNS.map((col) => (
                <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-raised">
                  <input type="checkbox" checked={columns.includes(col.id)} onChange={() => toggleColumn(col.id)} />
                  {col.label}
                </label>
              ))}
            </div>
          </details>
        </div>

        {(activeQuery || category || accountId || direction || unreadOnly) ? (
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters active
            <button className="font-medium text-primary hover:underline" onClick={clearFilters}>Clear all</button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50 text-xs text-muted-foreground">
                {columns.includes("peer") && <th className="px-4 py-3 text-left font-medium">Contact</th>}
                {columns.includes("subject") && <th className="px-4 py-3 text-left font-medium">Subject</th>}
                {columns.includes("preview") && <th className="px-4 py-3 text-left font-medium">Preview</th>}
                {columns.includes("mailbox") && <th className="px-4 py-3 text-left font-medium">Mailbox</th>}
                {columns.includes("category") && <th className="px-4 py-3 text-left font-medium">Folder</th>}
                {columns.includes("direction") && <th className="px-4 py-3 text-left font-medium">Direction</th>}
                {columns.includes("messages") && <th className="px-4 py-3 text-right font-medium">Msgs</th>}
                {columns.includes("unread") && <th className="px-4 py-3 text-right font-medium">Unread</th>}
                {columns.includes("date") && <th className="px-4 py-3 text-right font-medium">Last activity</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length || 1} className="px-4 py-12 text-center text-muted-foreground">Loading conversations…</td></tr>
              ) : threads.length === 0 ? (
                <tr><td colSpan={columns.length || 1} className="px-4 py-12 text-center text-muted-foreground">No matching conversations found.</td></tr>
              ) : threads.map((thread, index) => (
                <motion.tr
                  key={thread.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.01, 0.18), duration: 0.18 }}
                  onClick={() => router.push(`/emails/${thread.id}`)}
                  className="group cursor-pointer border-b border-border last:border-0 hover:bg-surface-raised/70"
                >
                  {columns.includes("peer") && <td className="px-4 py-3">
                    <p className="max-w-56 truncate font-semibold">{peer(thread)}</p>
                    <p className="max-w-56 truncate text-xs text-muted-foreground">{thread.from_address || thread.direction || "Conversation"}</p>
                  </td>}
                  {columns.includes("subject") && <td className="px-4 py-3"><p className="max-w-72 truncate font-medium">{thread.subject || "(no subject)"}</p></td>}
                  {columns.includes("preview") && <td className="px-4 py-3">
                    <p className="max-w-xl line-clamp-1 text-xs text-muted-foreground transition-all group-hover:line-clamp-4 group-hover:whitespace-pre-wrap">
                      {thread.summary || "No preview available."}
                    </p>
                  </td>}
                  {columns.includes("mailbox") && <td className="px-4 py-3 text-xs text-muted-foreground">{thread.mailbox_address || "—"}</td>}
                  {columns.includes("category") && <td className="px-4 py-3"><Tag tone={thread.mailbox_category === "Inbox" ? "primary" : thread.mailbox_category === "Sent" ? "success" : "neutral"}>{thread.mailbox_category || "Other"}</Tag></td>}
                  {columns.includes("direction") && <td className="px-4 py-3"><Tag tone={thread.direction === "inbound" ? "primary" : thread.direction === "outbound" ? "success" : "neutral"}>{thread.direction || "—"}</Tag></td>}
                  {columns.includes("messages") && <td className="px-4 py-3 text-right num">{thread.message_count || 0}</td>}
                  {columns.includes("unread") && <td className="px-4 py-3 text-right">{thread.unread_count > 0 ? <Tag tone="warning">{thread.unread_count}</Tag> : <span className="text-muted-foreground">0</span>}</td>}
                  {columns.includes("date") && <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground">{fmt(thread.last_message_at)}</td>}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">Page {page} of {pages} · {total.toLocaleString()} threads</p>
          <div className="flex gap-2">
            <Btn size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</Btn>
            <Btn size="sm" variant="outline" disabled={offset + pageSize >= total || loading} onClick={() => setOffset(offset + pageSize)}>Next</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}
