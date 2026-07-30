"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { dateLabel } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Tag, Avatar, Btn, Field, Input, Textarea } from "@/components/kit.launchpad";
import { CalendarClock, Paperclip, Send } from "lucide-react";

type TaskItem = {
  id: string;
  title: string;
  brief: string;
  assignee: string;
  project: string;
  due: string;
  priority: string;
  requiresFile: boolean;
  status: string;
};

export default function TasksPage() {
  const { profile, teamProfiles } = useApp();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [assignee, setAssignee] = useState("");
  const [project, setProject] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [requiresFile, setRequiresFile] = useState(false);
  const [notified, setNotified] = useState(false);

  const assignTask = useCallback(() => {
    if (!title.trim()) return;
    const task: TaskItem = {
      id: Date.now().toString(),
      title: title.trim(),
      brief,
      assignee: assignee || profile?.display_name || "Unassigned",
      project: project || "General",
      due,
      priority: "high",
      requiresFile,
      status: "open",
    };
    setTasks((prev) => [task, ...prev]);
    setTitle("");
    setBrief("");
    setNotified(true);
    setTimeout(() => setNotified(false), 3500);
  }, [title, brief, assignee, project, due, priority, requiresFile, profile]);

  const scheduleItems = tasks
    .filter((t) => t.due)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader variant="delivery"
        eyebrow="Delivery"
        title="Task scheduling"
        desc="Assign tasks to team members and track delivery."
      />

      {isAdmin && (
        <Panel>
          <PanelHead title="Assign a new task" />
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Task title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow up with Meridian" />
              </Field>
              <Field label="Assignee">
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                  <option value="">Select teammate...</option>
                  {teamProfiles.map((p) => (
                    <option key={p.user_id} value={p.display_name || p.email}>{p.display_name || p.email}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Brief">
              <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} placeholder="What needs to be done?" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Project">
                <select value={project} onChange={(e) => setProject(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                  <option value="">General</option>
                  {["Meridian Partners", "Halcyon Logistics", "Perch Retail", "Aura Ventures", "Zeniq Works"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Due date">
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
              <Field label="Priority">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                  {["high", "medium", "low"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresFile} onChange={(e) => setRequiresFile(e.target.checked)} className="h-4 w-4" />
              <span className="text-foreground">Require file upload as proof of work</span>
            </label>
            <div className="flex justify-end">
              <Btn variant="primary" onClick={assignTask} disabled={!title.trim()}>
                <Paperclip className="h-4 w-4" /> Assign task
              </Btn>
            </div>
          </div>
          {notified && (
            <div className="border-t border-border px-4 py-2 flex items-center gap-2 text-sm text-success">
              <Send className="h-4 w-4" /> Task assigned and teammate notified.
            </div>
          )}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Scheduled tasks" hint={`${tasks.length} total`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Task</th>
                  <th className="px-4 py-2.5 text-left font-medium">Assignee</th>
                  <th className="px-4 py-2.5 text-left font-medium">Due</th>
                  <th className="px-4 py-2.5 text-left font-medium">Priority</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No tasks scheduled yet.</td></tr>
                ) : tasks.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{t.title}</p>
                      {t.brief && <p className="text-xs text-muted-foreground">{t.brief}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.assignee}</td>
                    <td className="px-4 py-3"><span className="num text-muted-foreground">{t.due ? dateLabel(t.due) : "—"}</span></td>
                    <td className="px-4 py-3">
                      <Tag tone={t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "neutral"}>{t.priority}</Tag>
                    </td>
                    <td className="px-4 py-3">
                      <Tag tone="info">{t.status}</Tag>
                      {t.requiresFile && <Tag tone="neutral" className="ml-1"><Paperclip className="h-3 w-3" /></Tag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Today's schedule" hint={`${scheduleItems.length} items`} />
          <div className="divide-y divide-border">
            {scheduleItems.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No items scheduled for today.</div>
            ) : scheduleItems.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.assignee}</p>
                </div>
                <Tag tone={t.priority === "high" ? "danger" : "neutral"}>{t.priority}</Tag>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
