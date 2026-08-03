"use client";

import { useState, useCallback, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/Drawer";
import { Panel, PanelHead, Field, Input, Textarea, Btn } from "@/components/kit.launchpad";
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/Toast";

const supabase = createClient();

interface TaskRow {
  id: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  brief: string;
  due: string;
  priority: string;
}

export function ProjectCreateForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const { profile, teamProfiles, loadRemoteItems } = useApp();
  const { flash } = useToast();
  const isManager = profile?.role === "manager" || profile?.role === "admin";

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [owner, setOwner] = useState(profile?.display_name || "");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setCompany("");
      setOwner(profile?.display_name || "");
      setPriority("medium");
      setDue("");
      setValue("");
      setNotes("");
      setTasks([]);
    }
  }, [open, profile?.display_name]);

  const addTask = useCallback(() => {
    setTasks((prev) => [...prev, { id: Date.now().toString(), title: "", assigneeId: "", assigneeName: "", brief: "", due: "", priority: "medium" }]);
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTask = useCallback((id: string, field: keyof TaskRow, val: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: val } : t)));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !company.trim()) {
      flash("Please fill in the project title and company");
      return;
    }
    if (!isManager) {
      flash("Only managers can create projects");
      return;
    }
    setLoading(true);
    try {
      const { error: projectError } = await supabase.from("crm_board_items").insert({
        title: title.trim(),
        type: "project",
        company: company.trim(),
        owner: owner.trim() || profile?.display_name || "User",
        priority,
        due,
        value: Number(value) || 0,
        notes,
        status: "project_brief",
        assigned_to: profile?.user_id || "",
        visibility: "team",
      });
      if (projectError) { flash(projectError.message); return; }

      for (const task of tasks) {
        if (!task.title.trim()) continue;
        const { error: taskError } = await supabase.from("crm_board_items").insert({
          title: task.title.trim(),
          type: "task",
          company: company.trim(),
          owner: task.assigneeName || "Unassigned",
          priority: task.priority,
          due: task.due,
          notes: task.brief,
          status: "open",
          assigned_to: task.assigneeId || "",
          visibility: "team",
        });
        if (taskError) { flash(taskError.message); return; }
      }

      flash("Project created successfully");
      onClose();
      await loadRemoteItems();
      onCreated?.();
    } catch (err) {
      flash(String(err));
    } finally {
      setLoading(false);
    }
  }, [title, company, owner, priority, due, value, notes, tasks, isManager, profile, flash, loadRemoteItems, onClose, onCreated]);

  return (
    <Drawer open={open} onClose={onClose} title="New Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Panel>
          <PanelHead title="Project Details" />
          <div className="space-y-3 p-4">
            <Field label="Project title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Website Redesign" required />
            </Field>
            <Field label="Company / Client">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Meridian Partners" required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Owner">
                <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Project owner" />
              </Field>
              <Field label="Priority">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                  {["high", "medium", "low"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Due date">
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
              <Field label="Value (USD)">
                <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Project notes..." />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Assign Tasks" hint={`${tasks.length} task(s)`} action={
            <Btn size="sm" variant="outline" onClick={addTask} type="button">
              <Plus className="h-3 w-3" /> Add task
            </Btn>
          } />
          <div className="space-y-3 p-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks added yet. Click "Add task" to create one.</p>
            ) : tasks.map((task, index) => (
              <div key={task.id} className="rounded-lg border border-border bg-surface p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">Task {index + 1}</p>
                  <Btn size="sm" variant="danger" onClick={() => removeTask(task.id)} type="button"><X className="h-3 w-3" /></Btn>
                </div>
                <Field label="Task title">
                  <Input value={task.title} onChange={(e) => updateTask(task.id, "title", e.target.value)} placeholder="e.g. Design mockup" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Assignee">
                    <select value={task.assigneeId} onChange={(e) => {
                      const member = teamProfiles.find((p) => p.user_id === e.target.value);
                      updateTask(task.id, "assigneeId", e.target.value);
                      updateTask(task.id, "assigneeName", member?.display_name || member?.email || "");
                    }} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                      <option value="">Select team member...</option>
                      {teamProfiles.map((p) => (
                        <option key={p.user_id} value={p.user_id}>{p.display_name || p.email}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Due date">
                    <Input type="date" value={task.due} onChange={(e) => updateTask(task.id, "due", e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Priority">
                    <select value={task.priority} onChange={(e) => updateTask(task.id, "priority", e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                      {["high", "medium", "low"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </Field>
                  <Field label="Brief">
                    <Input value={task.brief} onChange={(e) => updateTask(task.id, "brief", e.target.value)} placeholder="Brief description" />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex justify-end gap-2">
          <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={loading || !title.trim() || !company.trim()}>
            {loading ? "Creating..." : "Create Project"}
          </Btn>
        </div>
      </form>
    </Drawer>
  );
}
