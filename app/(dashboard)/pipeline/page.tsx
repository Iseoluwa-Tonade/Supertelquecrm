"use client";

import { useMemo } from "react";

import { useApp } from "@/lib/AppContext";
import { daysUntil, dueLabel, money, statusTitle, label } from "@/lib/utils";
import { Avatar, Panel, PanelHead, PageHeader, Stat, Tag } from "@/components/kit.launchpad";

export default function PipelinePage() {
  const { items, profile } = useApp();

  const metrics = useMemo(() => {
    const dealItems = items.filter((item) => item.type === "deal");
    const active = dealItems.filter((item) => !["project_done", "project_delivered", "project_closed"].includes(item.status));
    const openValue = active.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const dueSoon = active.filter((item) => daysUntil(item.due) >= 0 && daysUntil(item.due) <= 7).length;
    const highPriority = active.filter((item) => item.priority === "high").length;
    return { dealItems, active, openValue, dueSoon, highPriority };
  }, [items]);

  const topDeals = metrics.dealItems.slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue"
        title="Deal pipeline"
        desc="The journey view is now presented with a cleaner Launchpad-style layout, while your current CRM data still drives the content."
        actions={<Tag tone="neutral">{label(profile?.role || "viewer")}</Tag>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open deals" value={String(metrics.active.length)} delta="Visible in the current journey" spark={[4, 5, 6, 5, 7, 8]} />
        <Stat label="Open value" value={money(metrics.openValue)} delta="Active revenue" spark={[5, 6, 6, 7, 7, 8]} />
        <Stat label="Due soon" value={String(metrics.dueSoon)} delta="Next 7 days" spark={[2, 3, 3, 4, 4, 5]} />
        <Stat label="High priority" value={String(metrics.highPriority)} delta="Needs attention" spark={[1, 2, 2, 3, 3, 4]} positive={false} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Pipeline board" hint="Primary opportunities from the current CRM dataset" />
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {topDeals.map((deal) => (
              <div key={deal.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="num text-[10px] text-muted-foreground">{deal.id}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{deal.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{deal.company}</p>
                  </div>
                  <Avatar initials={deal.owner.slice(0, 2).toUpperCase()} size="sm" tone="primary" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Tag tone={deal.priority === "high" ? "danger" : deal.priority === "medium" ? "warning" : "neutral"}>
                    {deal.priority}
                  </Tag>
                  <span className="num text-sm text-primary">{money(deal.value)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{statusTitle(deal.status)}</span>
                  <span>{dueLabel(deal.due)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Journey snapshot" hint="Count by stage" />
          <div className="space-y-3 p-4">
            {Array.from(new Set(metrics.dealItems.map((item) => item.status))).slice(0, 6).map((status) => {
              const count = metrics.dealItems.filter((item) => item.status === status).length;
              const sum = metrics.dealItems.filter((item) => item.status === status).reduce((total, item) => total + Number(item.value || 0), 0);
              return (
                <div key={status} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-sm font-medium text-foreground">{statusTitle(status)}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{count} deals</span>
                    <span>{money(sum)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
