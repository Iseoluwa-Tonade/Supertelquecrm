"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, CircleDot, Clock, Play } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { dateLabel, label } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { PageHeader, Panel, Tag, Btn } from "@/components/kit.launchpad";

const supabase = createClient();

export default function MyTasksPage() {
  const { profile, items, loadRemoteItems } = useApp();
  const { flash, success } = useToast();
  const [activeFilter, setActiveFilter] = useState("all");

  const tasks = useMemo(
    () =>
      items
        .filter((item) => item.type === "task" && item.assigned_to === profile?.user_id)
        .sort((a, b) => (a.due || "").localeCompare(b.due || "")),
    [items, profile?.user_id]
  );

  const filtered = activeFilter === "all" ? tasks : tasks.filter((task) => task.status === activeFilter);

  const counts = useMemo(
    () => ({
      open: tasks.filter((task) => task.status === "open" || task.status === "in_progress").length,
      review: tasks.filter((task) => task.status === "review").length,
      completed: tasks.filter((task) => task.status === "done").length,
    }),
    [tasks]
  );

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("crm_board_items").update({ status }).eq("id", id);
    if (error) return flash(error.message);
    await loadRemoteItems();
    if (status === "done") success("Task completed");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="delivery"
        eyebrow="Delivery"
        title="My tasks"
        desc="Your assigned work from the shared CRM task system."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-4 text-center">
          <p className="label-tag text-muted-foreground">Open</p>
          <p className="mt-1 text-2xl font-semibold">{counts.open}</p>
        </Panel>
        <Panel className="p-4 text-center">
          <p className="label-tag text-muted-foreground">Awaiting review</p>
          <p className="mt-1 text-2xl font-semibold">{counts.review}</p>
        </Panel>
        <Panel className="p-4 text-center">
          <p className="label-tag text-muted-foreground">Completed</p>
          <p className="mt-1 text-2xl font-semibold">{counts.completed}</p>
        </Panel>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all","open","in_progress","review","done"].map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === filter
                ? "bg-primary text-primary-foreground"
                : "bg-surface-raised text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter === "all" ? "All" : label(filter)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-muted-foreground">No tasks in this view.</Panel>
        ) : filtered.map((task) => (
          <Panel key={task.id} className={task.status === "done" ? "opacity-70" : ""}>
            <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
              <Link href={"/tasks/" + task.id} className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  {task.status === "done" ? <Check className="h-5 w-5 text-success" /> : <CircleDot className="h-5 w-5 text-muted-foreground" />}
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.notes || task.company}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Tag tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>{task.priority}</Tag>
                    <Tag tone={task.status === "done" ? "success" : task.status === "review" ? "info" : "primary"}>{label(task.status)}</Tag>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {task.due ? dateLabel(task.due) : "No due date"}
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex shrink-0 flex-wrap gap-2">
                {task.status === "open" && (
                  <Btn size="sm" variant="primary" onClick={() => updateStatus(task.id, "in_progress")}>
                    <Play className="h-3.5 w-3.5" /> Start
                  </Btn>
                )}
                {task.status === "in_progress" && (
                  <Btn size="sm" variant="primary" onClick={() => updateStatus(task.id, "review")}>
                    Send to review
                  </Btn>
                )}
                {task.status === "review" && (
                  <Btn size="sm" variant="primary" onClick={() => updateStatus(task.id, "done")}>
                    <Check className="h-3.5 w-3.5" /> Mark done
                  </Btn>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
