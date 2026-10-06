"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Mail } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { label, money, dueLabel, formatBytes } from "@/lib/utils";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type ItemKind = "deal" | "project" | "task";

type LinkedThread = { id: string; subject: string | null; message_count: number; last_message_at: string | null };

export function BoardItemPage({ kind }: { kind: ItemKind }) {
  const params = useParams<{ id: string }>();
  const { items, documents } = useApp();

  const id = params?.id;
  const item = items.find((row) => row.id === id && row.type === kind);
  const linkedDocs = documents.filter((doc) => doc.board_item_id === id);
  const [linkedThreads, setLinkedThreads] = useState<LinkedThread[]>([]);

  useEffect(() => {
    if (!id || kind !== "deal") {
      setLinkedThreads([]);
      return;
    }

    let cancelled = false;
    supabase
      .from("crm_email_threads")
      .select("id,subject,message_count,last_message_at")
      .eq("board_item_id", id)
      .order("last_message_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setLinkedThreads((data || []) as LinkedThread[]);
      });

    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  const backHref =
    kind === "deal" ? "/pipeline" :
    kind === "project" ? "/projects" :
    "/tasks";

  const recordLabel =
    kind === "deal" ? "Deal" :
    kind === "project" ? "Project" :
    "Task";

  if (!item) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM record"
          title={recordLabel}
          desc="This record could not be found or you do not have permission to view it."
        />
        <Link href={backHref}>
          <Btn><ArrowLeft className="h-4 w-4" /> Back</Btn>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {backHref.slice(1)}
      </Link>

      <PageHeader
        variant={kind === "deal" ? "revenue" : "delivery"}
        eyebrow={recordLabel}
        title={item.title}
        desc={item.company || "CRM record"}
        actions={
          <Tag
            tone={
              item.priority === "high"
                ? "danger"
                : item.priority === "medium"
                ? "warning"
                : "neutral"
            }
          >
            {label(item.priority)}
          </Tag>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
        <Panel>
          <PanelHead title={recordLabel + " details"} hint="Dedicated CRM record page" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Detail label="Company" value={item.company || "—"} />
            <Detail label="Owner" value={item.owner || "—"} />
            <Detail label="Status" value={label(item.status)} />
            <Detail label="Priority" value={label(item.priority)} />
            <Detail label="Due" value={dueLabel(item.due)} />
            {kind !== "task" ? (
              <Detail label="Value" value={money(item.value || 0)} />
            ) : null}
            <div className="sm:col-span-2">
              <p className="label-tag text-muted-foreground">Notes</p>
              <div className="mt-1 rounded-xl border border-border bg-surface p-3 text-sm leading-6 text-foreground/90">
                {item.notes || "No notes yet."}
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHead title="CRM links" />
            <div className="space-y-2 p-4">
              {kind === "deal" ? (
                <>
                  <Link href="/emails"><Btn className="w-full">Open related email</Btn></Link>
                  <Link href="/tasks"><Btn className="w-full">Open tasks</Btn></Link>
                </>
              ) : null}
              {kind === "project" ? (
                <>
                  <Link href="/tasks"><Btn className="w-full">Open project tasks</Btn></Link>
                  <Link href="/documents"><Btn className="w-full">Open documents</Btn></Link>
                </>
              ) : null}
              {kind === "task" ? (
                <Link href="/my-tasks"><Btn className="w-full">Open My Tasks</Btn></Link>
              ) : null}
            </div>
          </Panel>

          {kind === "deal" ? (
            <Panel>
              <PanelHead title={"Email conversations (" + linkedThreads.length + ")"} />
              <div className="space-y-2 p-4">
                {linkedThreads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No email conversations linked yet.</p>
                ) : (
                  linkedThreads.map((thread) => (
                    <Link
                      key={thread.id}
                      href={"/emails/" + thread.id}
                      className="flex items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-surface-raised"
                    >
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm">{thread.subject || "(no subject)"}</span>
                      <Tag tone="primary">{thread.message_count} msgs</Tag>
                    </Link>
                  ))
                )}
              </div>
            </Panel>
          ) : null}

          <Panel>
            <PanelHead title={"Documents (" + linkedDocs.length + ")"} />
            <div className="space-y-2 p-4">
              {linkedDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked documents.</p>
              ) : (
                linkedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{doc.file_name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Detail({ label: detailLabel, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-tag text-muted-foreground">{detailLabel}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
