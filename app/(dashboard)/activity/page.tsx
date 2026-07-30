"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useMemo, useState, useEffect } from "react";
import { label, todayIso, dateLabel } from "@/lib/utils";
import { Panel, PanelHead, PageHeader, Tag, Btn } from "@/components/kit.launchpad";
import { Plus, X, ArrowUpDown, Search } from "lucide-react";

const supabase = createClient();

type ColumnType = "text" | "select" | "date" | "checkbox";

interface CustomField {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];
}

type SortDir = "asc" | "desc" | null;

interface SortState {
  key: string;
  dir: SortDir;
}

const DEFAULT_COLUMNS: { key: string; label: string; type: ColumnType; width?: string }[] = [
  { key: "completed", label: "", type: "checkbox", width: "40px" },
  { key: "title", label: "Title", type: "text" },
  { key: "channel", label: "Channel", type: "select", width: "130px" },
  { key: "activity_date", label: "Date", type: "date", width: "120px" },
];

const CHANNELS = ["email", "call", "meeting", "proposal", "delivery", "admin", "general"];

function loadCustomFields(): CustomField[] {
  try {
    return JSON.parse(localStorage.getItem("crm_custom_fields") || "[]");
  } catch { return []; }
}

function saveCustomFields(fields: CustomField[]) {
  localStorage.setItem("crm_custom_fields", JSON.stringify(fields));
}

function loadFieldData(): Record<string, Record<string, string>> {
  try {
    return JSON.parse(localStorage.getItem("crm_custom_field_data") || "{}");
  } catch { return {}; }
}

function saveFieldData(data: Record<string, Record<string, string>>) {
  localStorage.setItem("crm_custom_field_data", JSON.stringify(data));
}

export default function ActivityPage() {
  const { activities, profile, session, loadRemoteActivities } = useApp();
  const { flash } = useToast();
  const isViewer = profile?.role === "viewer";
  const canEdit = Boolean(session) && !isViewer;

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldData, setFieldData] = useState<Record<string, Record<string, string>>>({});
  const [showFieldCreator, setShowFieldCreator] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<ColumnType>("text");
  const [sort, setSort] = useState<SortState>({ key: "activity_date", dir: "desc" });
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "done">("all");
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newChannel, setNewChannel] = useState("general");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setCustomFields(loadCustomFields());
    setFieldData(loadFieldData());
  }, []);

  useEffect(() => {
    saveCustomFields(customFields);
  }, [customFields]);

  useEffect(() => {
    saveFieldData(fieldData);
  }, [fieldData]);

  const allColumns = useMemo(() => {
    const cols = [...DEFAULT_COLUMNS];
    for (const f of customFields) {
      cols.push({ key: `cf_${f.id}`, label: f.name, type: f.type, width: f.type === "checkbox" ? "60px" : undefined });
    }
    return cols;
  }, [customFields]);

  const filtered = useMemo(() => {
    let result = [...activities];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.title.toLowerCase().includes(q) || a.channel.toLowerCase().includes(q));
    }
    if (filterChannel !== "all") result = result.filter((a) => a.channel === filterChannel);
    if (filterStatus === "open") result = result.filter((a) => !a.completed);
    if (filterStatus === "done") result = result.filter((a) => a.completed);

    if (sort.key && sort.dir) {
      result.sort((a, b) => {
        let aVal: string, bVal: string;
        if (sort.key.startsWith("cf_")) {
          const fid = sort.key.replace("cf_", "");
          aVal = (fieldData[a.id] || {})[fid] || "";
          bVal = (fieldData[b.id] || {})[fid] || "";
        } else if (sort.key === "completed") {
          aVal = a.completed ? "1" : "0";
          bVal = b.completed ? "1" : "0";
        } else {
          aVal = (a as any)[sort.key] || "";
          bVal = (b as any)[sort.key] || "";
        }
        const cmp = typeof aVal === "number" ? aVal - Number(bVal) : String(aVal).localeCompare(String(bVal));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [activities, search, filterChannel, filterStatus, sort, fieldData]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: "activity_date", dir: "desc" };
    });
  };

  const startEdit = (id: string, key: string, current: string) => {
    if (!canEdit) return;
    setEditing({ id, key });
    setEditValue(current);
  };

  const commitEdit = useCallback(async () => {
    if (!editing) return;
    const { id, key } = editing;

    if (key.startsWith("cf_")) {
      const fid = key.replace("cf_", "");
      setFieldData((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), [fid]: editValue },
      }));
      setEditing(null);
      return;
    }

    if (key === "title") {
      const { error } = await supabase.from("crm_daily_activities").update({ title: editValue }).eq("id", id);
      if (error) { flash(error.message); setEditing(null); return; }
      await loadRemoteActivities();
    } else if (key === "channel") {
      const { error } = await supabase.from("crm_daily_activities").update({ channel: editValue }).eq("id", id);
      if (error) { flash(error.message); setEditing(null); return; }
      await loadRemoteActivities();
    } else if (key === "activity_date") {
      const { error } = await supabase.from("crm_daily_activities").update({ activity_date: editValue }).eq("id", id);
      if (error) { flash(error.message); setEditing(null); return; }
      await loadRemoteActivities();
    }
    setEditing(null);
  }, [editing, editValue, supabase, loadRemoteActivities, flash]);

  const toggleCompleted = useCallback(async (id: string, current: boolean) => {
    if (!canEdit) return;
    const { error } = await supabase.from("crm_daily_activities").update({ completed: !current }).eq("id", id);
    if (error) { flash(error.message); return; }
    await loadRemoteActivities();
  }, [canEdit, supabase, loadRemoteActivities, flash]);

  const addActivity = useCallback(async () => {
    if (!canEdit || !newTitle.trim()) { flash("Enter an activity title"); return; }
    const { error } = await supabase.from("crm_daily_activities").insert({
      title: newTitle.trim(),
      channel: newChannel,
      activity_date: todayIso(),
      completed: false,
    });
    if (error) { flash(error.message); return; }
    await loadRemoteActivities();
    setNewTitle("");
    setNewChannel("general");
    setAdding(false);
    flash("Activity added");
  }, [canEdit, newTitle, newChannel, supabase, loadRemoteActivities, flash]);

  const deleteActivity = useCallback(async (id: string) => {
    if (!canEdit) return;
    const { error } = await supabase.from("crm_daily_activities").delete().eq("id", id);
    if (error) { flash(error.message); return; }
    await loadRemoteActivities();
    flash("Activity deleted");
  }, [canEdit, supabase, loadRemoteActivities, flash]);

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    const field: CustomField = {
      id: Date.now().toString(36),
      name: newFieldName.trim(),
      type: newFieldType,
      options: newFieldType === "select" ? ["Option 1", "Option 2", "Option 3"] : undefined,
    };
    setCustomFields((prev) => [...prev, field]);
    setNewFieldName("");
    setShowFieldCreator(false);
    flash(`Field "${field.name}" added`);
  };

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
    setFieldData((prev) => {
      const next = { ...prev };
      for (const actId of Object.keys(next)) {
        delete next[actId][id];
      }
      return next;
    });
  };

  const getCellValue = (activity: typeof activities[0], col: typeof allColumns[0]): string => {
    if (col.key === "completed") return activity.completed ? "1" : "0";
    if (col.key.startsWith("cf_")) {
      const fid = col.key.replace("cf_", "");
      return (fieldData[activity.id] || {})[fid] || "";
    }
    return (activity as any)[col.key] || "";
  };

  const renderCell = (activity: typeof activities[0], col: typeof allColumns[0]) => {
    const isEditing = editing?.id === activity.id && editing?.key === col.key;
    const value = getCellValue(activity, col);

    if (col.key === "completed") {
      return (
        <input
          type="checkbox"
          checked={activity.completed}
          onChange={() => toggleCompleted(activity.id, activity.completed)}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
      );
    }

    if (!canEdit) {
      if (col.type === "select") return <Tag tone="neutral">{label(value)}</Tag>;
      return <span className="text-sm text-foreground">{value}</span>;
    }

    if (isEditing) {
      if (col.type === "select") {
        const options = col.key === "channel" ? CHANNELS : customFields.find((f) => `cf_${f.id}` === col.key)?.options || [];
        return (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
            className="h-7 w-full rounded border border-primary/50 bg-input px-1.5 text-sm text-foreground outline-none"
            autoFocus
          >
            <option value="">—</option>
            {options.map((opt) => <option key={opt} value={opt}>{label(opt)}</option>)}
          </select>
        );
      }
      if (col.type === "date") {
        return (
          <input
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
            className="h-7 w-full rounded border border-primary/50 bg-input px-1.5 text-sm text-foreground outline-none"
            autoFocus
          />
        );
      }
      return (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
          className="h-7 w-full rounded border border-primary/50 bg-input px-1.5 text-sm text-foreground outline-none"
          autoFocus
        />
      );
    }

    if (col.type === "select") return <Tag tone="neutral">{label(value) || "—"}</Tag>;
    if (col.type === "date") return <span className="text-sm text-muted-foreground">{dateLabel(value)}</span>;
    if (col.type === "checkbox") return <span className="text-sm">{value === "true" || value === "yes" ? "✓" : "—"}</span>;
    return (
      <span className="text-sm text-foreground cursor-pointer hover:text-primary transition-colors">{value || <span className="text-muted-foreground/50 italic">Empty</span>}</span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader variant="operations"
        eyebrow="Operations"
        title="Activity log"
        desc="Track daily emails, calls, meetings and deliveries in a spreadsheet-like view."
      />

      <Panel>
        <PanelHead
          title=""
          action={
            <div className="flex items-center gap-2 flex-wrap">
              {adding ? (
                <div className="flex items-center gap-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Activity title..."
                    className="h-8 w-48 rounded border border-border bg-input px-2 text-sm text-foreground outline-none focus:border-primary/60"
                    onKeyDown={(e) => { if (e.key === "Enter") addActivity(); if (e.key === "Escape") { setAdding(false); setNewTitle(""); } }}
                    autoFocus
                  />
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    className="h-8 rounded border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60"
                  >
                    {CHANNELS.map((ch) => <option key={ch} value={ch}>{label(ch)}</option>)}
                  </select>
                  <Btn size="sm" variant="primary" onClick={addActivity}><Plus className="h-3.5 w-3.5" /> Add</Btn>
                  <Btn size="sm" onClick={() => { setAdding(false); setNewTitle(""); }}><X className="h-3.5 w-3.5" /></Btn>
                </div>
              ) : canEdit ? (
                <Btn size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Quick add</Btn>
              ) : null}
            </div>
          }
        />

        <div className="flex items-center gap-2 border-b border-border px-4 py-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded border border-border bg-input pl-8 pr-2 text-xs text-foreground outline-none focus:border-primary/60"
            />
          </div>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="h-8 rounded border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60"
          >
            <option value="all">All channels</option>
            {CHANNELS.map((ch) => <option key={ch} value={ch}>{label(ch)}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="h-8 rounded border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60"
          >
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="done">Done</option>
          </select>
          <Btn size="sm" onClick={() => setShowFieldCreator(true)} title="Add custom field">
            <Plus className="h-3.5 w-3.5" /> Field
          </Btn>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {allColumns.map((col) => (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width, minWidth: col.width } : { minWidth: col.key === "title" ? "200px" : "100px" }}
                    className={`select-none px-3 py-2.5 text-left text-xs font-medium text-muted-foreground ${col.key !== "completed" ? "cursor-pointer hover:text-foreground" : ""}`}
                    onClick={() => col.key !== "completed" && toggleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.key === "completed" ? null : <span>{col.label}</span>}
                      {sort.key === col.key ? (
                        <ArrowUpDown className={`h-3 w-3 ${sort.dir === "asc" ? "rotate-180" : ""} transition-transform`} />
                      ) : null}
                    </div>
                  </th>
                ))}
                <th className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={allColumns.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {search || filterChannel !== "all" || filterStatus !== "all"
                      ? "No activities match your filters."
                      : "No activities yet. Add your first one above."}
                  </td>
                </tr>
              ) : filtered.map((activity) => (
                <tr
                  key={activity.id}
                  className={`border-b border-border last:border-0 hover:bg-surface-raised/40 transition-colors ${activity.completed ? "opacity-60" : ""}`}
                >
                  {allColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 ${col.key === "title" ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (col.key !== "completed" && canEdit && editing === null) {
                          const val = getCellValue(activity, col);
                          if (col.key.startsWith("cf_") || col.key === "title" || col.key === "channel" || col.key === "activity_date") {
                            startEdit(activity.id, col.key, val);
                          }
                        }
                      }}
                    >
                      {renderCell(activity, col)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {canEdit && editing === null ? (
                      <button
                        onClick={() => deleteActivity(activity.id)}
                        className="grid h-6 w-6 place-items-center rounded text-xs text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover/row:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {customFields.length > 0 ? (
        <Panel>
          <PanelHead title="Custom fields" hint="Manage additional columns for your activity log" />
          <div className="divide-y divide-border">
            {customFields.map((field) => (
              <div key={field.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Tag tone="info">{field.type}</Tag>
                  <span className="text-sm text-foreground">{field.name}</span>
                </div>
                <Btn size="sm" variant="danger" onClick={() => removeCustomField(field.id)}>
                  <X className="h-3 w-3" /> Remove
                </Btn>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {showFieldCreator ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFieldCreator(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-popover p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Add custom field</h3>
            <p className="mt-1 text-xs text-muted-foreground">Create a new column in your activity table.</p>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Field name</span>
                <input
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g. Client name"
                  className="h-9 w-full rounded border border-border bg-input px-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                  onKeyDown={(e) => { if (e.key === "Enter") addCustomField(); }}
                  autoFocus
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Field type</span>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as ColumnType)}
                  className="h-9 w-full rounded border border-border bg-input px-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                >
                  <option value="text">Text</option>
                  <option value="select">Select (dropdown)</option>
                  <option value="date">Date</option>
                  <option value="checkbox">Checkbox</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Btn onClick={() => setShowFieldCreator(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={addCustomField}>Add field</Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
