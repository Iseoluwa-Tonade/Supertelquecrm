"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Send, Plus } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { dateLabel, label } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { PageHeader, Panel, PanelHead, Tag, Btn, Field, Input, Textarea, DropdownSelect } from "@/components/kit.launchpad";

const supabase = createClient();

export default function TasksPage() {
  const { profile, organisation, teamProfiles, items, loadRemoteItems } = useApp();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [project, setProject] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const tasks = useMemo(
    () => items.filter((item) => item.type === "task").sort((a, b) => (a.due || "").localeCompare(b.due || "")),
    [items]
  );

  const projectOptions = useMemo(() => {
    const names = Array.from(new Set(items.filter((item) => item.type === "project").map((item) => item.company || item.title).filter(Boolean)));
    return names;
  }, [items]);

  async function assignTask() {
    if (!canManage || !profile || !organisation?.id) return;
    if (!title.trim()) return flash("Enter a task title");

    const assignee = teamProfiles.find((member) => member.user_id === assigneeId);
    setSaving(true);

    const { data, error } = await supabase
      .from("crm_board_items")
      .insert({
        organisation_id: organisation.id,
        type: "task",
        title: title.trim(),
        company: project.trim() || "General",
        owner: assignee?.display_name || assignee?.email || profile.display_name || "Unassigned",
        assigned_to: assigneeId || profile.user_id,
        priority,
        value: 0,
        due: due || null,
        status: "open",
        notes: brief.trim(),
        visibility: "team",
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      return flash(error.message);
    }

    if (assigneeId && assigneeId !== profile.user_id) {
      await supabase.from("crm_notifications").insert({
        user_id: assigneeId,
        actor_id: profile.user_id,
        type: "task_assigned",
        title: "New task assigned: " + title.trim(),
        body: (profile.display_name || profile.email || "A manager") + " assigned you a task",
        item_id: data?.id || null,
      });
    }

    await loadRemoteItems();
    setTitle("");
    setBrief("");
    setAssigneeId("");
    setProject("");
    setDue("");
    setPriority("medium");
    setSaving(false);
    flash("Task assigned");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="delivery"
        eyebrow="Delivery"
        title="Task scheduling"
        desc="Persistent team tasks connected to projects, people and the dashboard."
      />

      {canManage && (
        <Panel>
          <PanelHead title="Assign a new task" />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Task title">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Follow up with Meridian" />
              </Field>
              <Field label="Assignee">
                <DropdownSelect
                  value={assigneeId}
                  onChange={setAssigneeId}
                  ariaLabel="Assignee"
                  placeholder="Select team member"
                  options={[
                    { value: "", label: "Assign to me" },
                    ...teamProfiles.map((member) => ({
                      value: member.user_id,
                      label: member.display_name || member.email || "Team member",
                    })),
                  ]}
                />
              </Field>
            </div>

            <Field label="Brief">
              <Textarea value={brief} onChange={(event) => setBrief(event.target.value)} rows={3} placeholder="What needs to be done?" />
            </Field>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Project / account">
                <DropdownSelect
                  value={project}
                  onChange={setProject}
                  ariaLabel="Project or account"
                  placeholder="General"
                  options={[
                    { value: "", label: "General" },
                    ...projectOptions.map((name) => ({ value: name, label: name })),
                  ]}
                />
              </Field>
              <Field label="Due date">
                <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
              </Field>
              <Field label="Priority">
                <DropdownSelect
                  value={priority}
                  onChange={setPriority}
                  ariaLabel="Priority"
                  placeholder="Choose priority"
                  options={["high","medium","low"].map((value) => ({ value, label: label(value) }))}
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <Btn variant="primary" onClick={assignTask} disabled={!title.trim() || saving}>
                <Send className="h-4 w-4" /> {saving ? "Assigning…" : "Assign task"}
              </Btn>
            </div>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHead title={"Scheduled tasks (" + tasks.length + ")"} hint="Stored in the CRM database" />
        <div className="divide-y divide-border">
          {tasks.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks yet. {canManage ? "Assign the first task above." : ""}
            </div>
          ) : tasks.map((task) => (
            <Link
              key={task.id}
              href={"/tasks/" + task.id}
              className="grid gap-3 px-4 py-4 transition-colors hover:bg-surface-raised/60 md:grid-cols-[minmax(0,1fr)_160px_120px_110px]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.notes || task.company}</p>
              </div>
              <div className="text-sm text-muted-foreground">{task.owner || "Unassigned"}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> {task.due ? dateLabel(task.due) : "No due date"}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Tag tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>{task.priority}</Tag>
                <Tag tone={task.status === "done" ? "success" : task.status === "review" ? "info" : "primary"}>{label(task.status)}</Tag>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
