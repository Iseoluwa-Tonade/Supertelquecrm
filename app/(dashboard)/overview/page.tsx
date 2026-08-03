"use client";

import { useApp } from "@/lib/AppContext";
import { money, label, dateLabel, daysUntil, dueLabel, statusTitle, statusColor, formatCompact, todayIso } from "@/lib/utils";
import { Panel, PanelHead, PageHeader, Tag, Avatar, Btn } from "@/components/kit.launchpad";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";
import { ArrowUpRight, Plus, Sparkles, TrendingUp, Clock, CheckCircle2, Calendar, Activity, Filter } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const priorityColor: Record<string, string> = {
  high: "var(--color-crm-rose)",
  medium: "var(--color-crm-amber)",
  low: "var(--color-crm-blue)",
};

export default function OverviewPage() {
  const { items, activities, documents, messages, changeRequests, profile } = useApp();
  const role = profile?.role || "viewer";
  const isManager = role === "manager" || role === "admin";
  const [pipelineView, setPipelineView] = useState<"bar" | "pie">("bar");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const doneStatuses = ["project_done", "project_delivered", "project_closed"];
  const activeItems = items.filter((item) => !doneStatuses.includes(item.status));
  const closedItems = items.filter((item) => doneStatuses.includes(item.status));
  const openValue = activeItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const closedValue = closedItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const avgDealSize = activeItems.length > 0 ? Math.round(openValue / activeItems.length) : 0;

  const today = todayIso();
  const todayActivities = activities.filter((a) => a.activity_date === today);
  const unreadMessages = messages.filter((msg) => msg.recipient_id === profile?.user_id && !msg.read_at).length;
  const pendingApprovals = changeRequests.filter((r) => r.status === "pending").length;
  const dueSoon = activeItems.filter((item) => daysUntil(item.due) >= 0 && daysUntil(item.due) <= 7).length;
  const overdue = activeItems.filter((item) => daysUntil(item.due) < 0).length;
  const myDeals = activeItems.filter((item) => item.assigned_to === profile?.user_id);

  const winRate = items.length > 0 ? Math.round((closedItems.length / items.length) * 100) : 0;

  const stats = [
    { label: "Pipeline value", value: money(openValue), delta: `${activeItems.length} active deals`, sub: `Avg ${money(avgDealSize)}`, icon: TrendingUp, color: "text-primary" },
    { label: "Win rate", value: `${winRate}%`, delta: `${closedItems.length} closed`, sub: `${items.length} total`, icon: Activity, color: "text-success" },
    { label: "Due this week", value: String(dueSoon), delta: `${overdue} overdue`, sub: `Of ${activeItems.length} active`, icon: Clock, color: "text-warning" },
    { label: "Approvals", value: String(pendingApprovals), delta: isManager ? "Review queue" : "Awaiting", sub: `${changeRequests.length} total`, icon: CheckCircle2, color: "text-info" },
  ];

  const pipelineStages = useMemo(() => {
    const stageMap = new Map<string, { count: number; value: number; color: string }>();
    for (const item of activeItems) {
      const existing = stageMap.get(item.status) || { count: 0, value: 0, color: statusColor(item.status) };
      existing.count++;
      existing.value += Number(item.value || 0);
      stageMap.set(item.status, existing);
    }
    return Array.from(stageMap.entries())
      .map(([status, data]) => ({ status, ...data, title: statusTitle(status) }))
      .sort((a, b) => b.count - a.count);
  }, [activeItems]);

  const maxStageCount = Math.max(...pipelineStages.map((s) => s.count), 1);
  const totalStageCount = pipelineStages.reduce((sum, stage) => sum + stage.count, 0);
  const pieSegments = useMemo(() => {
    if (totalStageCount === 0) return [];

    let cursor = 0;
    return pipelineStages.map((stage) => {
      const percent = (stage.count / totalStageCount) * 100;
      const start = cursor;
      cursor += percent;
      return {
        ...stage,
        percent,
        start,
        end: cursor,
      };
    });
  }, [pipelineStages, totalStageCount]);

  const pieGradient = pieSegments
    .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
    .join(", ");

  return (
    <>
      <div className="space-y-6">
      <PageHeader variant="overview"
        eyebrow="SuperTelque CRM"
        title="Operations dashboard"
actions={
          <>
            <Link href="/pipeline" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-raised">
              <Sparkles className="h-4 w-4" /> Weekly digest
            </Link>
            <Btn variant="primary" size="sm" onClick={() => setCreateProjectOpen(true)}>
              <Plus className="h-4 w-4" /> New item
            </Btn>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Panel key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="label-tag text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color} opacity-70`} />
            </div>
            <p className="num mt-2 text-2xl font-semibold text-foreground">{s.value}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="num text-xs text-muted-foreground">{s.delta}</span>
              <span className="text-[10px] text-muted-foreground/60">{s.sub}</span>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            title="Pipeline overview"
            hint={`${activeItems.length} active · ${pipelineStages.length} stages`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-border bg-surface-raised p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPipelineView("bar")}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      pipelineView === "bar"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipelineView("pie")}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      pipelineView === "pie"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pie
                  </button>
                </div>
              </div>
            }
          />
          <div className="p-4">
            {pipelineStages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active deals in the pipeline.</p>
            ) : pipelineView === "bar" ? (
              <div className="space-y-3">
                {pipelineStages.map((stage) => (
                  <div key={stage.status}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                        <span className="text-foreground">{stage.title}</span>
                      </span>
                      <span className="num text-xs text-muted-foreground">
                        {stage.count} · {money(stage.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-raised">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, (stage.count / maxStageCount) * 100)}%`, background: stage.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-center">
                <div className="flex justify-center">
                  <div className="relative h-56 w-56">
                    <div
                      className="h-full w-full rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_18px_38px_-24px_rgba(15,23,42,0.45)]"
                      style={{ background: `conic-gradient(${pieGradient})` }}
                    />
                    <div className="absolute inset-[22%] rounded-full border border-border bg-background shadow-inner">
                      <div className="flex h-full w-full flex-col items-center justify-center text-center">
                        <span className="label-tag text-muted-foreground">Active deals</span>
                        <span className="num mt-1 text-3xl font-semibold text-foreground">{totalStageCount}</span>
                        <span className="mt-1 text-xs text-muted-foreground">{pipelineStages.length} stages</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  {pieSegments.map((stage) => (
                    <div key={stage.status} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: stage.color }} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{stage.title}</p>
                          <p className="text-xs text-muted-foreground">{money(stage.value)} total</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="num text-sm font-semibold text-foreground">{stage.count}</p>
                        <p className="text-[10px] text-muted-foreground">{Math.round(stage.percent)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="At a glance" />
          <div className="space-y-2 p-4">
            {[
              { label: "Active deals", value: activeItems.length, icon: TrendingUp },
              { label: "Closed deals", value: closedItems.length, icon: CheckCircle2 },
              { label: "Documents", value: documents.length, icon: Activity },
              { label: "Unread messages", value: unreadMessages, icon: ArrowUpRight },
              { label: "Today's activity", value: todayActivities.length, icon: Calendar },
              { label: "Overdue", value: overdue, icon: Clock },
              { label: "My deals", value: myDeals.length, icon: Filter },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="num text-base font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead
          title="Active deals"
          hint="Recent deals with key metrics"
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{activeItems.length} records</span>
              <Link href="/pipeline">
                <Btn size="sm">View all</Btn>
              </Link>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Value</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Stage</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Priority</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Due</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Owner</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.slice(0, 10).map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-raised/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{item.company}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.title}</td>
                  <td className="num px-4 py-3 text-foreground">{money(item.value)}</td>
                  <td className="px-4 py-3">
                    <Tag tone="primary" className="text-[10px]">{statusTitle(item.status)}</Tag>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: priorityColor[item.priority] || "var(--color-crm-muted)" }}
                      />
                      <span className="text-xs text-muted-foreground">{label(item.priority)}</span>
                    </div>
                  </td>
                  <td className="num px-4 py-3 text-muted-foreground">{dueLabel(item.due)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar initials={(item.owner || "U").slice(0, 2).toUpperCase()} size="sm" />
                      <span className="text-xs text-muted-foreground">{item.owner}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead
            title="Recent activity"
            hint="Latest CRM events"
            action={
              <Link href="/activity" className="text-xs text-primary hover:underline">
                View log <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-raised/30 transition-colors">
                <Avatar initials={activity.title.slice(0, 2).toUpperCase()} size="sm" tone="primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity.title}</span>
                    <span className="text-muted-foreground"> · {label(activity.channel)}</span>
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Tag tone={activity.completed ? "success" : "neutral"} className="text-[10px]">
                      {activity.completed ? "Done" : "Open"}
                    </Tag>
                    <span className="text-xs text-muted-foreground">{dateLabel(activity.activity_date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Stage distribution" hint="Deal count by pipeline stage" />
          <div className="p-4">
            {pipelineStages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pipeline data.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pipelineStages.map((stage) => {
                  const pct = Math.round((stage.count / activeItems.length) * 100);
                  return (
                    <div key={stage.status} className="rounded-lg border border-border bg-surface p-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                        <span className="truncate text-xs text-muted-foreground">{stage.title}</span>
                      </div>
                      <p className="num mt-1.5 text-xl font-semibold text-foreground">{stage.count}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: stage.color }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">{money(stage.value)} · {pct}%</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
    <ProjectCreateForm
      open={createProjectOpen}
      onClose={() => setCreateProjectOpen(false)}
    />
    </>
  );
}
