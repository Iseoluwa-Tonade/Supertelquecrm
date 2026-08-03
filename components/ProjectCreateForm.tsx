"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/Drawer";
import { Field, Input, Textarea, Btn, DropdownSelect } from "@/components/kit.launchpad";
import { Plus, X, Paperclip } from "lucide-react";
import { useToast } from "@/components/Toast";
import { PROJECT_COLUMNS } from "@/lib/types";

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

const inputClass = "h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const toggleBase = "inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-semibold transition-all duration-200";

export function ProjectCreateForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const { session, profile, teamProfiles, loadRemoteItems, loadDocuments } = useApp();
  const { flash } = useToast();
  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [owner, setOwner] = useState(profile?.display_name || "");
  const [status, setStatus] = useState(PROJECT_COLUMNS[0].id);
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [docMode, setDocMode] = useState<"file" | "link">("file");
  const [documentUrl, setDocumentUrl] = useState("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setCompany("");
      setOwner(profile?.display_name || "");
      setStatus(PROJECT_COLUMNS[0].id);
      setPriority("medium");
      setDue("");
      setAttachment(null);
      setDocMode("file");
      setDocumentUrl("");
      setNotes("");
      setTasks([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const taskCountValid = tasks.filter((t) => t.title.trim()).length;
  const valid = title.trim().length > 0 && company.trim().length > 0;

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !company.trim()) {
      flash("Please fill in the project title and client/company");
      return;
    }
    if (!isManager) {
      flash("Only managers can create projects");
      return;
    }
    setLoading(true);
    try {
      const { data: project, error: projectError } = await supabase
        .from("crm_board_items")
        .insert({
          title: title.trim(),
          type: "project",
          company: company.trim(),
          owner: owner.trim() || profile?.display_name || "User",
          priority,
          due,
          status,
          notes,
          document_url: documentUrl.trim() || undefined,
          assigned_to: profile?.user_id || "",
          visibility: "team",
        })
        .select("id")
        .single();
      if (projectError) { flash(projectError.message); return; }

      if (attachment && project?.id) {
        if (attachment.size > 20 * 1024 * 1024) {
          flash("Sales document must be smaller than 20 MB");
        } else if (session?.user.id) {
          const path = session.user.id + "/" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "_" + attachment.name;
          const { error: uploadError } = await supabase.storage.from("crm-documents").upload(path, attachment);
          if (uploadError) { flash("Document upload failed: " + uploadError.message); }
          else {
            const { error: dbError } = await supabase.from("crm_documents").insert({
              board_item_id: project.id,
              file_name: attachment.name,
              file_path: path,
              file_type: attachment.type || "application/octet-stream",
              file_size: attachment.size,
              uploaded_by: session.user.id,
            });
            if (dbError) { flash("Document link failed: " + dbError.message); }
          }
        }
      }

      const creatorName = profile?.display_name || session?.user.email || "A manager";
      const notifications: {
        user_id: string;
        type: "project_created" | "task_assigned";
        title: string;
        body: string;
        item_id: string | null;
      }[] = [];

      const ownerMember = teamProfiles.find((p) => (p.display_name || p.email) === owner.trim());
      if (project?.id && ownerMember && ownerMember.user_id !== profile?.user_id) {
        notifications.push({
          user_id: ownerMember.user_id,
          type: "project_created",
          title: `New project: ${title.trim()}`,
          body: `${creatorName} assigned you as the owner of ${company.trim()}`,
          item_id: project.id,
        });
      }

      for (const task of tasks) {
        if (!task.title.trim()) continue;
        const { data: taskRow, error: taskError } = await supabase
          .from("crm_board_items")
          .insert({
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
          })
          .select("id")
          .single();
        if (taskError) { flash(taskError.message); return; }
        if (task.assigneeId && task.assigneeId !== profile?.user_id) {
          notifications.push({
            user_id: task.assigneeId,
            type: "task_assigned",
            title: `New task assigned: ${task.title.trim()}`,
            body: `${creatorName} assigned you "${task.title.trim()}" on ${company.trim()}`,
            item_id: taskRow?.id || null,
          });
        }
      }

      const { error: notifyError } = await supabase.from("crm_notifications").insert(notifications);
      if (notifyError) { flash("Notification delivery failed: " + notifyError.message); }

      flash("Project created successfully");
      onClose();
      await Promise.all([loadRemoteItems(), loadDocuments()]);
      onCreated?.();
    } catch (err) {
      flash(String(err));
    } finally {
      setLoading(false);
    }
  }, [title, company, owner, priority, status, due, attachment, documentUrl, session, teamProfiles, notes, tasks, isManager, profile, flash, loadRemoteItems, loadDocuments, onClose, onCreated]);

  return (
    <Drawer open={open} onClose={onClose} title="New project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="label-tag text-crm-sidebar-muted">Project</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Project name">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Website redesign" required />
          </Field>
          <Field label="Client / company">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Meridian Partners" required />
          </Field>
          <Field label="Delivery stage">
            <DropdownSelect
              value={status}
              onChange={setStatus}
              placeholder="Choose stage"
              ariaLabel="Delivery stage"
              options={PROJECT_COLUMNS.map((col) => ({ value: col.id, label: col.title }))}
            />
          </Field>

          <Field label="Priority">
            <DropdownSelect
              value={priority}
              onChange={setPriority}
              placeholder="Choose priority"
              ariaLabel="Priority"
              options={["high", "medium", "low"].map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
            />
          </Field>
          <Field label="Project owner">
            <DropdownSelect
              value={owner}
              onChange={setOwner}
              placeholder="Choose owner"
              ariaLabel="Project owner"
              options={[
                ...(profile?.display_name ? [{ value: profile.display_name, label: `Me · ${profile.display_name}` }] : []),
                ...teamProfiles
                  .filter((p) => p.display_name !== profile?.display_name)
                  .map((p) => ({ value: p.display_name || p.email, label: p.display_name || p.email })),
              ]}
            />
          </Field>
          <Field label="Deadline">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Project document">
              <div className="mb-3 flex w-full justify-end">
                <div className="inline-flex items-end rounded-full border border-border/80 bg-surface/80 p-1 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.22)] backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setDocMode("file")}
                    className={toggleBase + " min-w-27 " + (docMode === "file" ? "bg-primary text-primary-foreground shadow-[0_8px_18px_-12px_rgba(15,118,110,0.8)]" : "text-muted-foreground hover:bg-white/60 hover:text-foreground")}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocMode("link")}
                    className={toggleBase + " min-w-27 " + (docMode === "link" ? "bg-primary text-primary-foreground shadow-[0_8px_18px_-12px_rgba(15,118,110,0.8)]" : "text-muted-foreground hover:bg-white/60 hover:text-foreground")}
                  >
                    Paste link
                  </button>
                </div>
              </div>
              {docMode === "file" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-foreground/70 transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {attachment ? attachment.name : "Choose a file"}
                    </span>
                  </button>
                  {attachment && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachment(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-crm-sidebar-muted transition-colors hover:bg-white/5 hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <Input
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(e) => {
                  setAttachment(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </Field>
          </div>
        </div>

        <Field label="Description">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Scope, goals and deliverables" />
        </Field>

        <div className="flex items-center justify-between pt-1">
          <p className="label-tag text-crm-sidebar-muted">Tasks ({taskCountValid})</p>
          <Btn size="sm" variant="outline" onClick={addTask} type="button">
            <Plus className="h-3 w-3" /> Add task
          </Btn>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-crm-sidebar-muted">No tasks added.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div key={task.id} className="space-y-3 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">Task {index + 1}</p>
                  <Btn size="sm" variant="danger" onClick={() => removeTask(task.id)} type="button"><X className="h-3 w-3" /></Btn>
                </div>
                <Field label="Title">
                  <Input value={task.title} onChange={(e) => updateTask(task.id, "title", e.target.value)} placeholder="e.g. Design the homepage mockup" />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Assignee">
                    <DropdownSelect
                      value={task.assigneeId}
                      onChange={(nextValue) => {
                        const member = teamProfiles.find((p) => p.user_id === nextValue);
                        updateTask(task.id, "assigneeId", nextValue);
                        updateTask(task.id, "assigneeName", member?.display_name || member?.email || "");
                      }}
                      placeholder="Select team member..."
                      ariaLabel={`Assignee for task ${index + 1}`}
                      options={[
                        { value: "", label: "Select team member..." },
                        ...teamProfiles.map((p) => ({ value: p.user_id, label: p.display_name || p.email })),
                      ]}
                    />
                  </Field>
                  <Field label="Due date">
                    <Input type="date" value={task.due} onChange={(e) => updateTask(task.id, "due", e.target.value)} />
                  </Field>
                  <Field label="Priority">
                    <DropdownSelect
                      value={task.priority}
                      onChange={(nextValue) => updateTask(task.id, "priority", nextValue)}
                      placeholder="Choose priority"
                      ariaLabel={`Priority for task ${index + 1}`}
                      options={["high", "medium", "low"].map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                    />
                  </Field>
                  <Field label="Brief">
                    <Input value={task.brief} onChange={(e) => updateTask(task.id, "brief", e.target.value)} placeholder="Short description" />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={loading || !valid}>
            {loading ? "Creating..." : valid ? `Create project${taskCountValid > 0 ? ` + ${taskCountValid} task${taskCountValid === 1 ? "" : "s"}` : ""}` : "Enter details"}
          </Btn>
        </div>
      </form>
    </Drawer>
  );
}