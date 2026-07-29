"use client";

import { useApp } from "@/lib/AppContext";
import { dateLabel } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

export default function NotificationsPage() {
  const { changeRequests, messages, profile } = useApp();
  const myId = profile?.user_id;

  const notifications = [
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
        title: `Message from ${m.sender_email || "teammate"}`,
        desc: m.body.slice(0, 80),
        date: m.created_at || "",
        type: "message" as const,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Notifications"
        desc={`${notifications.length} unread items`}
      />

      <Panel>
        <PanelHead title={`Notifications (${notifications.length})`} />
        <div className="divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No notifications yet.</div>
          ) : notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3">
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.type === "approval" ? "bg-warning" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Tag tone={n.type === "approval" ? "warning" : "primary"}>{n.type}</Tag>
                <span className="num text-xs text-muted-foreground">{n.date ? dateLabel(n.date.slice(0, 10)) : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
