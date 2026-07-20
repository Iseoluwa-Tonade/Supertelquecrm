"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState } from "react";
import { label, dateLabel } from "@/lib/utils";
import type { CrmMessage, Profile } from "@/lib/types";

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
    (messageThreadWith ? { id: messageThreadWith, email: messageThreadEmail || "Teammate", messages: [] as CrmMessage[] } : null);

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
    <div className="board-scroll overflow-auto min-h-0">
      <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
        <div className="overview-grid grid grid-cols-[1.15fr_0.85fr] max-md:grid-cols-1 gap-[14px]">
          <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
            <div className="flex gap-2 flex-wrap items-center">
              <h2 className="m-0 text-[15px] flex-1">Conversations ({threads.length})</h2>
              {isManager && (
                <button onClick={() => setComposeOpen(!composeOpen)}
                  className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3">
                  New message
                </button>
              )}
            </div>

            {composeOpen && (
              <div className="border-t border-b border-crm-line py-3 grid gap-2">
                <select value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)}
                  className="h-[32px]">
                  <option value="">Choose a teammate...</option>
                  {teamProfiles.filter((p) => p.user_id !== myId).map((p) => (
                    <option key={p.user_id} value={p.user_id} data-email={p.email}>{p.display_name || p.email || "Teammate"}</option>
                  ))}
                </select>
                <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)}
                  rows={2} placeholder="Write a message..." className="resize-y leading-[1.4]" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setComposeOpen(false)}>Cancel</button>
                  <button onClick={() => {
                    if (newRecipient && newBody.trim()) {
                      const recipient = teamProfiles.find((p) => p.user_id === newRecipient);
                      setMessageThreadWith(newRecipient);
                      setMessageThreadEmail(recipient?.email || "");
                      sendMessage(newRecipient, recipient?.email || "", newBody.trim());
                    }
                  }}
                    className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3">
                    Send
                  </button>
                </div>
              </div>
            )}

            <div className="message-thread-list grid gap-2 max-h-[60vh] overflow-auto">
              {threads.length === 0 ? (
                <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">
                  No conversations yet. {isManager ? "Start one with New message above." : "A manager or admin can start one with you."}
                </div>
              ) : threads.map((thread) => {
                const last = thread.messages[thread.messages.length - 1];
                const unread = thread.messages.filter((msg) => msg.recipient_id === myId && !msg.read_at).length;
                return (
                  <button key={thread.id} onClick={() => { setMessageThreadWith(thread.id); setMessageThreadEmail(thread.email); setComposeOpen(false); markRead(thread.id); }}
                    className={"grid grid-cols-[1fr_auto] gap-[2px_8px] text-left p-[10px_12px] bg-crm-panel border border-crm-line rounded-[6px] " +
                      (messageThreadWith === thread.id ? "border-crm-accent" : "")}>
                    <strong className="text-[13px]">{thread.email || "Teammate"}</strong>
                    <span className="text-crm-muted text-[12px] overflow-hidden text-ellipsis whitespace-nowrap">{(last?.body || "").slice(0, 60)}</span>
                    {unread > 0 && (
                      <span className="row-span-2 self-center min-w-[20px] h-[20px] rounded-[10px] grid place-items-center bg-[#facc15] text-[#1f2933] text-[11px] font-extrabold px-[5px]">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeThread ? (
            <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
              <h2 className="m-0 text-[15px]">{activeThread.email || "Teammate"}</h2>
              <div className="message-list grid gap-2 max-h-[50vh] overflow-auto pr-1">
                {activeThread.messages.length === 0 ? (
                  <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">No messages yet. Say hello.</div>
                ) : activeThread.messages.map((msg) => (
                  <div key={msg.id}
                    className={"max-w-[80%] rounded-[10px] p-[8px_12px] " +
                      (msg.sender_id === myId
                        ? "justify-self-end bg-crm-accent text-white border-transparent"
                        : "justify-self-start bg-crm-panel-strong border border-crm-line")}>
                    <p className="m-0 text-[13px] leading-[1.4] whitespace-pre-wrap break-words">{msg.body}</p>
                    <span className="block mt-1 text-[11px] opacity-70">
                      {dateLabel((msg.created_at || "").slice(0, 10))} {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (replyBody.trim() && messageThreadWith) sendMessage(messageThreadWith, messageThreadEmail || "", replyBody.trim()); }}
                className="grid gap-2">
                <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)}
                  rows={2} placeholder="Write a reply..." className="resize-y leading-[1.4]" required />
                <div className="flex justify-end gap-2">
                  <button type="submit"
                    className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3">
                    Send
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
              <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">Select a conversation to view it.</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
