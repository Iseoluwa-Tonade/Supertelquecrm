"use client";

import { useMemo } from "react";

import { useApp } from "@/lib/AppContext";
import { money, dueLabel, daysUntil, label } from "@/lib/utils";
import { Avatar, PageHeader, Panel, PanelHead, Stat, Tag } from "@/components/kit.launchpad";

export default function ProjectsPage() {
  const { items, profile } = useApp();

  const metrics = useMemo(() => {
    const projects = items.filter((item) => item.type === "project");
    const open = projects.filter((item) => !["project_delivered", "project_closed"].includes(item.status));
    const delivered = projects.filter((item) => ["project_delivered", "project_closed"].includes(item.status));
    const openValue = open.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const overdue = open.filter((item) => daysUntil(item.due) < 0).length;
    const dueSoon = open.filter((item) => daysUntil(item.due) >= 0 && daysUntil(item.due) <= 7).length;
    return { projects, open, delivered, openValue, overdue, dueSoon };
  }, [items]);

  const visibleProjects = metrics.projects.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader variant="delivery"
        eyebrow="Delivery"
        title="Projects"
        desc="A higher-signal project view that matches the newer Launchpad style while still showing your current CRM records."
        actions={<Tag tone="neutral">{label(profile?.role || "viewer")}</Tag>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open projects" value={String(metrics.open.length)} delta="Active delivery work" spark={[5, 6, 6, 7, 7, 8]} />
        <Stat label="Delivered" value={String(metrics.delivered.length)} delta="Completed work" spark={[2, 3, 4, 5, 5, 6]} />
        <Stat label="Open value" value={money(metrics.openValue)} delta="In delivery" spark={[4, 5, 5, 6, 7, 7]} />
        <Stat label="Due soon" value={String(metrics.dueSoon)} delta="Next 7 days" spark={[1, 2, 3, 3, 4, 4]} positive={false} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Active projects" hint="Delivery work currently in motion" />
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((project) => (
              <div key={project.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="num text-[10px] text-muted-foreground">{project.id}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{project.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{project.company}</p>
                  </div>
                  <Avatar initials={project.owner.slice(0, 2).toUpperCase()} size="sm" tone="accent" />
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, project.priority === "high" ? 85 : project.priority === "medium" ? 55 : 35)}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <Tag tone="neutral">{project.type}</Tag>
                  <span>{dueLabel(project.due)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Delivery health" hint="Open items by status" />
          <div className="space-y-3 p-4">
            {metrics.open.slice(0, 5).map((project) => (
              <div key={project.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
                  <Avatar initials={project.owner.slice(0, 2).toUpperCase()} size="sm" />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{project.company}</span>
                  <span>{money(Number(project.value || 0))}</span>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              {metrics.overdue} overdue projects need attention.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
