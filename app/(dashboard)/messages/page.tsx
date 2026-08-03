"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState } from "react";
import { label, dateLabel } from "@/lib/utils";
import type { CrmMessage, Profile } from "@/lib/types";
import { Panel, PanelHead, PageHeader, Tag, Btn, Avatar, DropdownSelect } from "@/components/kit.launchpad";

const supabase = createClient();

export default function MessagesPage() {
  const { session, profile, messages, teamProfiles, messageThreadWith, messageThreadEmail,
    setMessageThreadWith, setMessageThreadEmail, loadMessages, loadTeamProfiles } = useApp();
  const { flash } = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const myId = session?.user?.id;

  function messageThreads() {
    const map = new Map<string, { id: string; email: string; messages: CrmMessage[] }>();
    if (!myId) return [];
    messages.forEach((msg) => {
      const counterpartId = msg.sender_id === myId ? msg.recipient_id : msg.sender_id;
      const counterpartEmail = msg.sender_id === myId ? msg.recipient_email : msg.sender_email;
      if (!map.has(counterpartId)) map.set(counterpartId, { id: counterpartId, email: counterpartEmail, messages: [] });
      map.get(counterpartId)!.messages.push(msg);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1]?.created_at || "";
      const bLast = b.messages[b.messages.length - 1]?.created_at || "";
      return bLast.localeCompare(aLast);
    });
  }

  const threads = messageThreads();
  const activeThread = threads.find((t) => t.id === messageThreadWith) ||
    (messageThreadWith ? { id: messageThreadWith, email: messageThreadEmail || "Team member", messages: [] as CrmMessage[] } : null);

  const sendMessage = useCallback(async (recipientId: string, recipientEmail: string, body: string) => {
    if (!session) return;
    const { error } = await supabase.from("crm_messages").insert({
      sender_id: session.user.id,
      sender_email: session.user.email || "",
      recipient_id: recipientId,
      recipient_email: recipientEmail || "",
      body,
    });
    if (error) { flash(error.message); return; }
    await loadMessages();
    setReplyBody("");
    setNewBody("");
    setComposeOpen(false);
  }, [session, loadMessages, flash]);

  const markRead = useCallback(async (counterpartId: string) => {
    if (!myId) return;
    const unread = messages.filter((msg) => msg.sender_id === counterpartId && msg.recipient_id === myId && !msg.read_at);
    if (!unread.length) return;
    const now = new Date().toISOString();
    await Promise.all(unread.map((msg) => supabase.from("crm_messages").update({ read_at: now }).eq("id", msg.id)));
    await loadMessages();
  }, [myId, messages, loadMessages]);

  return (
    <div className="space-y-6">
      <PageHeader variant="overview"
        eyebrow="Operations"
        title="Messages"
        desc="Direct messages between team members."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <PanelHead
            title={`Conversations (${threads.length})`}
            action={isManager && (
              <Btn size="sm" variant="primary" onClick={() => setComposeOpen(!composeOpen)}>
                New message
              </Btn>
            )}
          />

          {composeOpen && (
            <div className="border-b border-border p-4 space-y-3">
              <DropdownSelect
                value={newRecipient}
                onChange={setNewRecipient}
                ariaLabel="Choose a team member"
                placeholder="Choose a team member..."
                options={[
                  { value: "", label: "Choose a team member..." },
                  ...teamProfiles.filter((p) => p.user_id !== myId).map((p) => ({ value: p.user_id, label: p.display_name || p.email || "Team member" })),
                ]}
              />
              <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={2} placeholder="Write a message..." className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 resize-y leading-relaxed" />
              <div className="flex justify-end gap-2">
                <Btn size="sm" onClick={() => setComposeOpen(false)}>Cancel</Btn>
                <Btn size="sm" variant="primary" onClick={() => {
                  if (newRecipient && newBody.trim()) {
                    const recipient = teamProfiles.find((p) => p.user_id === newRecipient);
                    setMessageThreadWith(newRecipient);
                    setMessageThreadEmail(recipient?.email || "");
                    sendMessage(newRecipient, recipient?.email || "", newBody.trim());
                  }
                }}>Send</Btn>
              </div>
            </div>
          )}

          <div className="max-h-[60vh] overflow-auto">
            {threads.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No conversations yet. {isManager ? "Start one with New message above." : "A manager or admin can start one with you."}
              </div>
            ) : threads.map((thread) => {
              const last = thread.messages[thread.messages.length - 1];
              const unread = thread.messages.filter((msg) => msg.recipient_id === myId && !msg.read_at).length;
              return (
                <button key={thread.id} onClick={() => { setMessageThreadWith(thread.id); setMessageThreadEmail(thread.email); setComposeOpen(false); markRead(thread.id); }}
                  className={`w-full flex items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-raised ${messageThreadWith === thread.id ? "bg-primary/5" : ""}`}>
                  <Avatar initials={(thread.email || "T").slice(0, 2).toUpperCase()} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{thread.email || "Team member"}</p>
                    <p className="truncate text-xs text-muted-foreground">{(last?.body || "").slice(0, 60)}</p>
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-bold text-warning-foreground">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Panel>

        {activeThread ? (
          <Panel>
            <PanelHead title={activeThread.email || "Team member"} />
            <div className="max-h-[50vh] space-y-2 overflow-auto p-4">
              {activeThread.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
              ) : activeThread.messages.map((msg) => (
                <div key={msg.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.sender_id === myId ? "ml-auto bg-primary text-primary-foreground" : "bg-surface-raised border border-border"}`}>
                  <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{msg.body}</p>
                  <span className="mt-1 block text-[11px] opacity-70">
                    {dateLabel((msg.created_at || "").slice(0, 10))} {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (replyBody.trim() && messageThreadWith) sendMessage(messageThreadWith, messageThreadEmail || "", replyBody.trim()); }} className="border-t border-border p-4 space-y-2">
              <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={2} placeholder="Write a reply..." className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 resize-y leading-relaxed" required />
              <div className="flex justify-end">
                <Btn type="submit" variant="primary" size="sm">Send</Btn>
              </div>
            </form>
          </Panel>
        ) : (
          <Panel className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Select a conversation to view it.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
