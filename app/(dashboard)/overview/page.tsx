"use client";

import Link from "next/link";

import { useApp } from "@/lib/AppContext";
import { money, label, dateLabel, daysUntil, dueLabel, statusTitle, statusColor } from "@/lib/utils";
import { Panel, PanelHead, PageHeader, Stat, Tag, Avatar } from "@/components/kit.launchpad";
import { ArrowUpRight, Plus, Sparkles } from "lucide-react";

export default function OverviewPage() {
  const { items, activities, documents, messages, changeRequests, profile } = useApp();
  const role = profile?.role || "viewer";
  const isAdmin = role === "admin";
  const isManager = role === "manager" || role === "admin";

  const doneStatuses = ["project_done", "project_delivered", "project_closed"];
  const activeItems = items.filter((item) => !doneStatuses.includes(item.status));
  const openValue = activeItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const closedValue = items
    .filter((item) => doneStatuses.includes(item.status))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayActivities = activities.filter((activity) => activity.activity_date === today);
  const unreadMessages = messages.filter((msg) => msg.recipient_id === profile?.user_id && !msg.read_at).length;
  const pendingApprovals = changeRequests.filter((request) => request.status === "pending").length;
  const dueSoon = items.filter((item) => daysUntil(item.due) >= 0 && daysUntil(item.due) <= 7).length;
  const openDocuments = documents.length;

  const totals = [
    { label: "Open value", value: money(openValue), delta: `${activeItems.length} active`, spark: [4, 5, 6, 7, 6, 8] },
    { label: "Closed value", value: money(closedValue), delta: `${doneStatuses.length} stages`, spark: [2, 4, 3, 5, 6, 7] },
    { label: "Due soon", value: String(dueSoon), delta: "Next 7 days", spark: [3, 4, 4, 5, 4, 6] },
    { label: "Pending approvals", value: String(pendingApprovals), delta: isManager ? "Review queue" : "Manager review", spark: [1, 2, 3, 2, 4, 3] },
  ];

  const recentItems = items.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SuperTelque CRM"
        title="Operations dashboard"
        desc="A cleaner Launchpad-style overview powered by your existing CRM data."
        actions={
          <>
            <Tag tone="neutral">{label(role)}</Tag>
            <Link href="/pipeline" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-raised">
              <Sparkles className="h-4 w-4" /> Weekly digest
            </Link>
            <Link href="/projects" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> New item
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {totals.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} delta={stat.delta} spark={stat.spark} positive />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            title="Current journey"
            hint="Live status across the visible CRM records"
            action={<Tag tone="primary">{items.length} records</Tag>}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {recentItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.company}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                  </div>
                  <Avatar initials={(item.owner || "U").slice(0, 2).toUpperCase()} size="sm" tone="muted" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <Tag tone="neutral">{statusTitle(item.status)}</Tag>
                  <span className="num text-muted-foreground">{isAdmin ? money(item.value) : dueLabel(item.due)}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(12, (item.value / Math.max(openValue || 1, 1)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Stage snapshot" hint="Count by current journey step" />
          <div className="divide-y divide-border">
            {Array.from(
              new Map(
                items.map((item) => [
                  item.status,
                  { count: 0, value: 0, title: statusTitle(item.status), color: statusColor(item.status) },
                ]),
              ),
            ).map(([status, info]) => {
              const statusItems = items.filter((item) => item.status === status);
              const sum = statusItems.reduce((total, item) => total + Number(item.value || 0), 0);
              return (
                <div key={status} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: info.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{info.title}</span>
                  <span className="num text-xs text-muted-foreground">{statusItems.length}</span>
                  <span className="num w-16 text-right text-xs text-foreground">{money(sum)}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            title="Today's activity"
            hint="Recent CRM activity from your existing data"
            action={
              <Link href="/activity" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View log <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {activities.slice(0, 5).map((activity) => (
              <li key={activity.id} className="flex gap-3 px-4 py-3">
                <Avatar initials={activity.title.slice(0, 2).toUpperCase()} size="sm" tone="primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">{activity.title}</span>{" "}
                    <span className="text-muted-foreground">{activity.channel}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{dateLabel(activity.activity_date)} {activity.completed ? "· done" : "· open"}</p>
                </div>
                <span className="num text-xs text-muted-foreground">{activity.completed ? "✓" : "…"}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHead
            title="Queue"
            hint="Things that need attention"
          />
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="label-tag text-muted-foreground">Documents</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{openDocuments}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="label-tag text-muted-foreground">Unread messages</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{unreadMessages}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="label-tag text-muted-foreground">Today</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{todayActivities.length}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
