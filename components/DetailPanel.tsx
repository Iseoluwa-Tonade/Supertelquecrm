"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { PIPELINE_COLUMNS, PROJECT_COLUMNS } from "@/lib/types";
import { label, money, money as statusTitle, isSafeUrl, formatBytes, docIcon } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { Btn, Tag, Avatar, Input, Field } from "@/components/kit.launchpad";

const supabase = createClient();

export default function DetailPanel() {
  const {
    items, selectedId, setSelectedId, profile, documents, session, changeRequests,
    loadRemoteItems, loadChangeRequests, loadDocuments, previewDoc, setPreviewDoc,
  } = useApp();
  const { flash } = useToast();
  const pathname = usePathname();
  const view = pathname.split("/").filter(Boolean)[0] || "overview";

  const item = items.find((i) => i.id === selectedId);
  const role = profile?.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager" || role === "admin";
  const isViewer = role === "viewer";
  const pending = changeRequests.filter((r) => r.board_item_id === selectedId && r.status === "pending");
  const linkedDocs = documents.filter((doc) => doc.board_item_id === selectedId);

  const activeColumns = view === "projects" ? PROJECT_COLUMNS : PIPELINE_COLUMNS;

  const saveItem = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!item || !session) return;
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    const fields = ["title", "company", "owner", "type", "priority", "status", "value", "due", "notes", "document_url"];
    fields.forEach((key) => {
      const val = form.get(key);
      if (val !== null && String(val) !== String((item as unknown as Record<string, unknown>)[key] ?? "")) {
        if (key === "value") payload[key] = Number(val) || 0;
        else payload[key] = String(val);
      }
    });

    if (Object.keys(payload).length === 0) { flash("No changes to save"); return; }

    if (isManager) {
      const { error } = await supabase.from("crm_board_items").update(payload).eq("id", item.id);
      if (error) { flash(error.message); return; }
      await loadRemoteItems();
      flash("Saved");
    } else {
      const existingPending = pending.length > 0;
      if (existingPending) { flash("There's already a pending change request for this item"); return; }
      const { error } = await supabase.from("crm_change_requests").insert({
        board_item_id: item.id,
        action: "update",
        before_payload: fields.reduce((acc, k) => ({ ...acc, [k]: (item as unknown as Record<string, unknown>)[k] ?? null }), {}),
        payload,
      });
      if (error) { flash(error.message); return; }
      await loadChangeRequests();
      flash("Change request submitted for review");
    }
  }, [item, session, isManager, isViewer, supabase, loadRemoteItems, loadChangeRequests, flash, pending.length]);

  const deleteItem = useCallback(async () => {
    if (!item || !session) return;
    if (isManager) {
      const { error } = await supabase.from("crm_board_items").delete().eq("id", item.id);
      if (error) { flash(error.message); return; }
      setSelectedId(null);
      await loadRemoteItems();
      flash("Deleted");
    } else {
      const existingPending = pending.length > 0;
      if (existingPending) { flash("There's already a pending change request for this item"); return; }
      const { error } = await supabase.from("crm_change_requests").insert({
        board_item_id: item.id,
        action: "delete",
        before_payload: { title: item.title, company: item.company },
      });
      if (error) { flash(error.message); return; }
      setSelectedId(null);
      await loadChangeRequests();
      flash("Delete request submitted for review");
    }
  }, [item, session, isManager, supabase, setSelectedId, loadRemoteItems, loadChangeRequests, flash, pending.length]);

  if (!item) {
    return (
      <aside className="fixed right-0 top-0 bottom-0 z-10 w-[min(360px,100vw)] animate-slide-in-right border-l border-border bg-popover grid grid-rows-[auto_1fr] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">Detail</p>
          <Btn size="sm" onClick={() => setSelectedId(null)}>&times;</Btn>
        </div>
        <div className="flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">No item selected.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed right-0 top-0 bottom-0 z-10 w-[min(360px,100vw)] animate-slide-in-right border-l border-border bg-popover grid grid-rows-[auto_1fr] shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <Btn size="sm" onClick={() => setSelectedId(null)}>&times;</Btn>
      </div>

      <div className="overflow-y-auto p-4 space-y-4">
        {pending.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
            {pending.length} pending change request{pending.length > 1 ? "s" : ""} — waiting for approval.
          </div>
        )}

        <form onSubmit={saveItem} className="space-y-3">
          <Field label="Title">
            <Input name="title" defaultValue={item.title} disabled={isViewer} required />
          </Field>
          <Field label="Company">
            <Input name="company" defaultValue={item.company} disabled={isViewer} required />
          </Field>
          <Field label="Owner">
            <Input name="owner" defaultValue={item.owner} disabled={isViewer} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select name="type" defaultValue={item.type} disabled={isViewer} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                <option value="deal">Deal</option>
                <option value="project">Project</option>
              </select>
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue={item.priority} disabled={isViewer} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                {["high", "medium", "low"].map((p) => <option key={p} value={p}>{label(p)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Status">
            <select name="status" defaultValue={item.status} disabled={isViewer} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
              {activeColumns.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}
            </select>
          </Field>
          <Field label={isAdmin ? "Value (USD)" : "Value"}>
            <Input name="value" type="number" min="0" defaultValue={item.value || 0} disabled={isViewer} />
          </Field>
          <Field label="Due date">
            <Input name="due" type="date" defaultValue={item.due?.slice(0, 10) || ""} disabled={isViewer} />
          </Field>
          <Field label="Notes">
            <textarea name="notes" defaultValue={item.notes || ""} disabled={isViewer} rows={3} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 resize-y leading-relaxed" />
          </Field>
          <Field label="Sales document link">
            <Input name="document_url" defaultValue={item.document_url || ""} disabled={isViewer} placeholder="https://..." />
          </Field>

          {!isViewer && (
            <div className="flex justify-end gap-2 flex-wrap pt-1">
              <Btn type="button" variant="danger" size="sm" onClick={() => { if (confirm("Delete this item?")) deleteItem(); }}>
                Delete
              </Btn>
              <Btn type="submit" variant="primary" size="sm">Save</Btn>
            </div>
          )}
        </form>

        {item.document_url && isSafeUrl(item.document_url) && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="label-tag text-muted-foreground">Sales document</p>
            <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Open sales document &rarr;
            </a>
          </div>
        )}

        <div>
          <p className="label-tag mb-2 text-muted-foreground">Linked documents ({linkedDocs.length})</p>
          {linkedDocs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents linked to this item.</p>
          ) : (
            <div className="space-y-1.5">
              {linkedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 cursor-pointer hover:bg-surface-raised transition-colors">
                  <span className="text-base">{docIcon(doc.file_type)}</span>
                  <span className="flex-1 truncate text-xs text-foreground">{doc.file_name}</span>
                  <span className="text-[10px] text-muted-foreground">{formatBytes(doc.file_size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
