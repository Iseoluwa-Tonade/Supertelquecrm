"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { dateLabel } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { PageHeader, Panel, PanelHead, Tag, Avatar, Btn } from "@/components/kit.launchpad";
import { Check, CircleDot, Clock, FileUp, Play } from "lucide-react";

type TaskStatus = "todo" | "in-progress" | "submitted" | "done";

type MyTask = {
  id: string;
  title: string;
  brief: string;
  project: string;
  assignedBy: string;
  due: string;
  priority: string;
  requiresFile: boolean;
  status: TaskStatus;
  attachment?: string;
};

export default function MyTasksPage() {
  const { profile } = useApp();
  const { flash } = useToast();
  const filterOptions: TaskStatus[] = ["todo", "in-progress", "submitted", "done"];
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const [tasks, setTasks] = useState<MyTask[]>([
    { id: "MT-101", title: "Follow up on Meridian proposal", brief: "Send revised quote and timeline", project: "Meridian Partners", assignedBy: "Tunde Bakare", due: "2026-08-05", priority: "high", requiresFile: false, status: "in-progress" },
    { id: "MT-102", title: "Review Halcyon deliverable", brief: "Check final draft before client review", project: "Halcyon Logistics", assignedBy: "Tunde Bakare", due: "2026-07-30", priority: "high", requiresFile: true, status: "todo" },
    { id: "MT-103", title: "Prepare monthly ops report", brief: "Compile activity data for last month", project: "Internal", assignedBy: "Simi Bello", due: "2026-08-01", priority: "medium", requiresFile: false, status: "submitted" },
    { id: "MT-104", title: "Schedule kickoff call", brief: "Coordinate with Aura Ventures team", project: "Aura Ventures", assignedBy: "Simi Bello", due: "2026-07-28", priority: "medium", requiresFile: false, status: "todo" },
    { id: "MT-105", title: "Update pricing catalog", brief: "Add new Q3 service tiers", project: "Internal", assignedBy: "Tunde Bakare", due: "2026-07-25", priority: "low", requiresFile: false, status: "done" },
  ]);

  const filtered = activeFilter === "all" ? tasks : tasks.filter((t) => t.status === activeFilter);

  const counts = useMemo(() => ({
    open: tasks.filter((t) => t.status === "todo" || t.status === "in-progress").length,
    review: tasks.filter((t) => t.status === "submitted").length,
    completed: tasks.filter((t) => t.status === "done").length,
  }), [tasks]);

  const updateTask = (id: string, status: TaskStatus, attachment?: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, ...(attachment ? { attachment } : {}) } : t)));
  };

  const canAssign = profile?.role === "admin" || profile?.role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader variant="delivery"
        eyebrow="Delivery"
        title="My tasks"
        desc="Your assigned work and deliverables."
      />

      <div className="flex items-center gap-2 flex-wrap">
        {["all", ...filterOptions].map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === f ? "bg-primary text-primary-foreground" : "bg-surface-raised text-muted-foreground hover:text-foreground"
            }`}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1).replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-4 text-center">
          <p className="label-tag text-muted-foreground">Open</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{counts.open}</p>
        </Panel>
        <Panel className="p-4 text-center">
          <p className="label-tag text-muted-foreground">Awaiting review</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{counts.review}</p>
        </Panel>
        <Panel className="p-4 text-center">
          <p className="label-tag text-muted-foreground">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{counts.completed}</p>
        </Panel>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Panel className="p-6 text-center text-sm text-muted-foreground">No tasks in this view.</Panel>
        ) : filtered.map((t) => (
          <Panel key={t.id} className={t.status === "done" ? "opacity-70" : ""}>
            <div className="flex items-start gap-3 p-4">
              <div className="mt-0.5">
                {t.status === "done" ? (
                  <Check className="h-5 w-5 text-success" />
                ) : (
                  <CircleDot className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.brief}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Tag tone={t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "neutral"}>{t.priority}</Tag>
                  <Tag tone={t.status === "done" ? "success" : t.status === "submitted" ? "info" : t.status === "in-progress" ? "primary" : "neutral"}>{t.status}</Tag>
                  {t.requiresFile && <Tag tone="neutral"><FileUp className="mr-1 h-3 w-3" /> File required</Tag>}
                  {t.attachment && <Tag tone="accent">Attached: {t.attachment}</Tag>}
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="num">{t.id}</span>
                  <span>{t.project}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {dateLabel(t.due)}</span>
                  <span className="flex items-center gap-1"><Avatar initials={t.assignedBy.slice(0, 2).toUpperCase()} size="sm" /> {t.assignedBy}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {t.status === "todo" && (
                  <Btn size="sm" variant="primary" onClick={() => updateTask(t.id, "in-progress")}>
                    <Play className="h-3.5 w-3.5" /> Start
                  </Btn>
                )}
                {t.requiresFile && t.status !== "done" && (
                  <Btn size="sm" onClick={() => updateTask(t.id, t.status, `${t.id}_deliverable.pdf`)}>
                    <FileUp className="h-3.5 w-3.5" /> {t.attachment ? "Replace" : "Upload"}
                  </Btn>
                )}
                {t.status !== "done" && t.status !== "todo" && (
                  <Btn size="sm" variant="primary" onClick={() => { updateTask(t.id, "done"); flash(`${t.title} completed`); }}
                    disabled={t.requiresFile && !t.attachment}>
                    <Check className="h-3.5 w-3.5" /> Mark done
                  </Btn>
                )}
                {t.status === "done" && (
                  <Tag tone="success">completed · {t.assignedBy} notified</Tag>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>


    </div>
  );
}
