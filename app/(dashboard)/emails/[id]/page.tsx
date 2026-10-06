"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, Send, Inbox, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/AppContext";
import { useToast } from "@/components/Toast";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type Thread = {
  id: string;
  subject: string | null;
  last_message_at: string | null;
  message_count: number;
  board_item_id: string | null;
};

type EmailRow = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  from_address: string | null;
  from_name: string | null;
  to_addresses: string[];
  subject: string | null;
  summary: string | null;
  body_text: string | null;
  received_at: string | null;
  sent_at: string | null;
  folder_name: string | null;
  has_attachments: boolean;
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

export default function EmailThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, organisation } = useApp();
  const { flash } = useToast();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const canManage = profile?.role === "admin" || profile?.role === "manager";
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [threadRes, messageRes] = await Promise.all([
        supabase.from("crm_email_threads").select("id,subject,last_message_at,message_count,board_item_id").eq("id", id).maybeSingle(),
        supabase
          .from("crm_emails")
          .select("id,direction,from_address,from_name,to_addresses,subject,summary,body_text,received_at,sent_at,folder_name,has_attachments")
          .eq("thread_id", id)
          .order("received_at", { ascending: true, nullsFirst: false }),
      ]);

      if (!cancelled) {
        setThread((threadRes.data as Thread | null) || null);
        setMessages((messageRes.data || []) as EmailRow[]);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  async function createPipelineDeal() {
    if (!thread || !profile || !organisation?.id || !canManage) return;

    const firstInbound = messages.find((message) => message.direction === "inbound");
    const sender = firstInbound?.from_address || "";
    const domain = sender.includes("@") ? sender.split("@")[1] : "";
    const company = domain
      ? domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
      : firstInbound?.from_name || "Email prospect";

    const { data, error } = await supabase
      .from("crm_board_items")
      .insert({
        organisation_id: organisation.id,
        type: "deal",
        title: thread.subject || "Email opportunity",
        company,
        owner: profile.display_name || profile.email || "Owner",
        assigned_to: profile.user_id,
        priority: "medium",
        value: 0,
        due: null,
        status: "responded_email",
        notes: "Created from Zoho email conversation",
        visibility: "team",
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      flash(error?.message || "Could not create deal");
      return;
    }

    const { error: linkError } = await supabase
      .from("crm_email_threads")
      .update({ board_item_id: data.id })
      .eq("id", thread.id);

    if (linkError) {
      flash(linkError.message);
      return;
    }

    setThread({ ...thread, board_item_id: data.id });
    router.push("/pipeline/" + data.id);
  }

  return (
    <div className="space-y-6">
      <Link href="/emails" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to email
      </Link>

      <PageHeader
        variant="revenue"
        eyebrow="Zoho Email"
        title={thread?.subject || "Email conversation"}
        desc={thread ? thread.message_count + " message" + (thread.message_count === 1 ? "" : "s") + " in this thread" : "Conversation"}
        actions={
          <div className="flex items-center gap-2">
            {thread?.board_item_id ? (
              <Btn size="sm" variant="outline" onClick={() => router.push("/pipeline/" + thread.board_item_id)}>
                <TrendingUp className="h-4 w-4" /> Linked deal
              </Btn>
            ) : canManage ? (
              <Btn size="sm" variant="primary" onClick={createPipelineDeal}>
                <TrendingUp className="h-4 w-4" /> Create pipeline deal
              </Btn>
            ) : null}
            <Tag tone="success">Threaded</Tag>
          </div>
        }
      />

      <Panel>
        <PanelHead title="Conversation" hint={thread?.last_message_at ? "Last activity " + fmt(thread.last_message_at) : undefined} />
        <div className="space-y-4 p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading conversation…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages are available in this thread.</p>
          ) : messages.map((message) => (
            <article key={message.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    {message.direction === "outbound" ? <Send className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {message.from_name || message.from_address || (message.direction === "outbound" ? "You" : "Unknown sender")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      To: {(message.to_addresses || []).join(", ") || "—"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{fmt(message.received_at || message.sent_at)}</p>
                  <Tag tone={message.direction === "outbound" ? "success" : "primary"} className="mt-1">
                    {message.folder_name || message.direction}
                  </Tag>
                </div>
              </div>

              <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                {message.body_text || message.summary || "Full body sync is pending for this message."}
              </div>

              {message.has_attachments && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" /> Attachment metadata available
                </div>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
