"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useCallback } from "react";
import { dateLabel } from "@/lib/utils";
import type { InviteRequest, Profile } from "@/lib/types";
import { PageHeader, Panel, PanelHead, Tag, Btn } from "@/components/kit.launchpad";
import { FolderPlus, ClipboardList, BellRing } from "lucide-react";

const supabase = createClient();

export default function NotificationsPage() {
  const { notifications, loadNotifications, markNotificationsRead, changeRequests, messages, profile, inviteRequests } = useApp();
  const myId = profile?.user_id;

  const unread = notifications.filter((n) => !n.read_at);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("crm_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    await loadNotifications();
  }, [loadNotifications]);

  const systemItems = [
    ...inviteRequests
      .filter((r) => r.status === "pending")
      .map((r) => {
        const requester = (r as InviteRequest & { requester?: Partial<Profile> }).requester;
        return {
          id: r.id,
          title: `Invite request from ${requester?.display_name || requester?.email || "a team member"}`,
          desc: `${requester?.email || "Unknown email"} wants to join your organisation`,
          date: r.created_at || "",
          type: "invite" as const,
        };
      }),
    ...changeRequests
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: r.id,
        title: `Change request: ${r.action}`,
        desc: `${r.action} on ${r.board_item_id?.slice(0, 8) || "new item"}`,
        date: r.requested_at || "",
        type: "approval" as const,
      })),
    ...messages
      .filter((m) => m.recipient_id === myId && !m.read_at)
      .map((m) => ({
        id: m.id,
        title: `Message from ${m.sender_email || "team member"}`,
        desc: m.body.slice(0, 80),
        date: m.created_at || "",
        type: "message" as const,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <PageHeader variant="overview"
        eyebrow="Overview"
        title="Notifications"
        desc={unread.length === 0 ? "You're all caught up" : `${unread.length} unread notification${unread.length === 1 ? "" : "s"}`}
        actions={
          unread.length > 0 ? (
            <Btn size="sm" variant="outline" onClick={() => markNotificationsRead()}>
              <BellRing className="h-3.5 w-3.5" /> Mark all as read
            </Btn>
          ) : undefined
        }
      />

      <Panel>
        <PanelHead title={`Notifications (${notifications.length})`} />
        <div className="divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No notifications yet.</div>
          ) : notifications.map((n) => {
            const isUnread = !n.read_at;
            const Icon = n.type === "project_created" ? FolderPlus : ClipboardList;
            return (
              <button
                key={n.id}
                onClick={() => { if (isUnread) markRead(n.id); }}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${isUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-white/5"} ${isUnread ? "cursor-pointer" : "cursor-default"}`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isUnread ? "text-primary" : "text-muted-foreground/60"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${isUnread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>{n.title}</p>
                  {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isUnread ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                  <span className="num text-xs text-muted-foreground">{n.created_at ? dateLabel(n.created_at.slice(0, 10)) : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Invite requests & approvals" />
        <div className="divide-y divide-border">
          {systemItems.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No pending requests.</div>
          ) : systemItems.map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3">
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.type === "approval" ? "bg-warning" : n.type === "invite" ? "bg-success" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Tag tone={n.type === "approval" ? "warning" : n.type === "invite" ? "success" : "primary"}>{n.type}</Tag>
                <span className="num text-xs text-muted-foreground">{n.date ? dateLabel(n.date.slice(0, 10)) : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
