"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { PIPELINE_COLUMNS, PROJECT_COLUMNS } from "@/lib/types";
import { label, money, money as statusTitle, isSafeUrl, formatBytes, docIcon } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useCallback } from "react";
import { usePathname } from "next/navigation";

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
  const columns = activeColumns;

  const saveItem = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isViewer) { flash("Viewers have read-only access"); return; }
    if (!item || !selectedId) return;

    const form = new FormData(e.currentTarget);
    const docUrl = (form.get("document_url") as string)?.trim();
    if (docUrl && !isSafeUrl(docUrl)) { flash("Document link must start with http:// or https://"); return; }

    const patch = {
      title: (form.get("title") as string)?.trim(),
      company: (form.get("company") as string)?.trim(),
      owner: (form.get("owner") as string)?.trim(),
      type: form.get("type"),
      priority: form.get("priority"),
      status: form.get("status"),
      value: Number(form.get("value") || 0),
      due: (form.get("due") as string) || null,
      notes: (form.get("notes") as string)?.trim(),
      document_url: docUrl || "",
    };

    if (!isManager) {
      flash("Sent for approval");
      return;
    }

    const { error } = await supabase.from("crm_board_items").update(patch).eq("id", selectedId);
    if (error) { flash(error.message); return; }
    await loadRemoteItems();
    flash("Saved");
  }, [isViewer, isManager, selectedId, item, loadRemoteItems, flash]);

  const deleteItem = useCallback(async () => {
    if (!selectedId) return;
    if (!isManager) { flash("Sent for approval"); return; }
    const { error } = await supabase.from("crm_board_items").delete().eq("id", selectedId);
    if (error) { flash(error.message); return; }
    await loadRemoteItems();
    setSelectedId(null);
    flash("Deleted");
  }, [isManager, selectedId, loadRemoteItems, setSelectedId, flash]);

  const openPreview = useCallback(async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    setPreviewDoc(doc);
  }, [documents, setPreviewDoc]);

  const deleteDocument = useCallback(async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const { error: storageError } = await supabase.storage.from("crm-documents").remove([doc.file_path]);
    if (storageError) { flash(storageError.message); return; }
    const { error } = await supabase.from("crm_documents").delete().eq("id", docId);
    if (error) { flash(error.message); return; }
    await loadDocuments();
    if (previewDoc?.id === docId) setPreviewDoc(null);
    flash("Document deleted");
  }, [documents, previewDoc, loadDocuments, setPreviewDoc, flash]);

  if (!item) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-[4]" onClick={() => setSelectedId(null)} />
        <aside className="bg-crm-panel border-l border-crm-line grid grid-rows-[auto_minmax(0,1fr)] min-w-0 fixed right-0 top-0 bottom-0 w-[min(360px,100vw)] shadow-[0_12px_30px_rgba(15,23,42,.08)] z-[5] animate-slide-in-right">
          <div className="p-4 border-b border-crm-line flex justify-between items-center gap-[10px]">
            <h2 className="m-0 text-[16px]">Details</h2>
            <button onClick={() => setSelectedId(null)} className="w-[34px] h-[34px] grid place-items-center p-0">&times;</button>
          </div>
          <div className="p-4 overflow-auto">
            <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4 text-[14px] leading-[1.45]">
              Select a card to edit account details, ownership, priority, due date, value, and notes.
            </div>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[4]" onClick={() => setSelectedId(null)} />
      <aside className="bg-crm-panel border-l border-crm-line grid grid-rows-[auto_minmax(0,1fr)] min-w-0 fixed right-0 top-0 bottom-0 w-[min(360px,100vw)] shadow-[0_12px_30px_rgba(15,23,42,.08)] z-[5] animate-slide-in-right">
        <div className="p-4 border-b border-crm-line flex justify-between items-center gap-[10px]">
          <h2 className="m-0 text-[16px]">{item.company}</h2>
          <button onClick={() => setSelectedId(null)} className="w-[34px] h-[34px] grid place-items-center p-0">&times;</button>
        </div>

        <div className="p-4 overflow-auto grid gap-4">
          {pending.length > 0 && (
            <div className="border border-[#fde68a] bg-[#fffbeb] text-[#92400e] dark:bg-[rgba(251,191,36,.1)] dark:border-[rgba(251,191,36,.35)] dark:text-[#fcd34d] rounded-[7px] p-[10px] text-[12px] leading-[1.4]">
              {pending.length} pending edit{pending.length === 1 ? "" : "s"} waiting for approval. Approved board data stays unchanged until review.
            </div>
          )}

          {isViewer && (
            <div className="border border-[#fde68a] bg-[#fffbeb] text-[#92400e] dark:bg-[rgba(251,191,36,.1)] dark:border-[rgba(251,191,36,.35)] dark:text-[#fcd34d] rounded-[7px] p-[10px] text-[12px] leading-[1.4]">
              You have read-only access to this record.
            </div>
          )}

          <form onSubmit={saveItem} className="grid gap-3">
            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Title
              <input name="title" defaultValue={item.title} disabled={isViewer} />
            </label>
            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Company
              <input name="company" defaultValue={item.company} disabled={isViewer} />
            </label>
            <div className="grid grid-cols-2 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Owner
                <input name="owner" defaultValue={item.owner} disabled={isViewer} />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Type
                <select name="type" defaultValue={item.type} disabled={isViewer}>
                  {["deal", "project", "task"].map((v) => <option key={v} value={v}>{label(v)}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Priority
                <select name="priority" defaultValue={item.priority} disabled={isViewer}>
                  {["high", "medium", "low"].map((v) => <option key={v} value={v}>{label(v)}</option>)}
                </select>
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Status
                <select name="status" defaultValue={item.status} disabled={isViewer}>
                  {columns.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              {isAdmin ? (
                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Value
                  <input name="value" type="number" min="0" step="100" defaultValue={Number(item.value || 0)} disabled={isViewer} />
                </label>
              ) : <input type="hidden" name="value" value={Number(item.value || 0)} />}
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Due date
                <input name="due" type="date" defaultValue={item.due} disabled={isViewer} />
              </label>
            </div>
            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Notes
              <textarea name="notes" defaultValue={item.notes} disabled={isViewer} className="min-h-[84px] resize-y leading-[1.4]" />
            </label>
            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Sales document link
              <input name="document_url" type="url" placeholder="https://..." defaultValue={item.document_url} disabled={isViewer} />
            </label>

            {!isViewer && (
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { if (confirm("Delete this item?")) deleteItem(); }} className="text-crm-rose border-[#fecdd3]">
                  Delete
                </button>
                <button type="submit" className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3 hover:brightness-105">
                  {isManager ? "Save" : "Send for approval"}
                </button>
              </div>
            )}
          </form>

          <div>
            <h2 className="m-0 text-[15px] mb-2">Documents ({linkedDocs.length})</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {linkedDocs.length === 0 ? (
                <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4 text-[14px]">
                  No documents linked to this record yet.
                </div>
              ) : linkedDocs.map((doc) => (
                <div key={doc.id} className="border border-crm-line rounded-[var(--radius,8px)] p-3 bg-crm-panel grid gap-2 cursor-pointer hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(15,23,42,.1)] transition-[transform,box-shadow] duration-150">
                  <div className="w-[36px] h-[36px] rounded-[8px] bg-crm-panel-strong grid place-items-center text-[16px]">
                    {docIcon(doc.file_type)}
                  </div>
                  <h3 className="m-0 text-[13px] leading-[1.3] break-words">{doc.file_name}</h3>
                  <span className="text-crm-muted text-[11px]">{formatBytes(doc.file_size)}</span>
                  <div className="flex gap-2 items-center">
                    <button type="button" onClick={() => openPreview(doc.id)} className="text-[12px] min-h-auto py-1 px-2">Preview</button>
                    {(isManager || doc.uploaded_by === session?.user?.id) && (
                      <button type="button" onClick={() => deleteDocument(doc.id)} className="w-[28px] min-h-[28px] text-crm-rose ml-auto">&times;</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
