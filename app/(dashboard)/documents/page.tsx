"use client";

import { useApp } from "@/lib/AppContext";
import { useToast } from "@/components/Toast";
import { useCallback, useRef, useState } from "react";
import { label, formatBytes, docIcon, dateLabel } from "@/lib/utils";
import type { CrmDocument } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const OFFICE_PREVIEW_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const TEXT_PREVIEW_EXTENSIONS = ["txt", "csv", "json", "md", "log"];

export default function DocumentsPage() {
  const { session, profile, documents, items, previewDoc, setPreviewDoc, loadDocuments, docFilterItem, setDocFilterItem } = useApp();
  const { flash } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [linkId, setLinkId] = useState("");

  const isViewer = profile?.role === "viewer";
  const isManager = profile?.role === "manager" || profile?.role === "admin";

  const filteredDocs = documents
    .filter((doc) => docFilterItem === "all" || doc.board_item_id === docFilterItem)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const uploadDocuments = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    if (isViewer) { flash("Viewers have read-only access"); return; }
    if (!session) { flash("Sign in to upload documents"); return; }

    flash("Uploading...");
    let succeeded = 0;
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        flash(file.name + ": files must be smaller than 20 MB");
        continue;
      }
      const path = session.user.id + "/" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "_" + file.name;
      const { error: uploadError } = await supabase.storage.from("crm-documents").upload(path, file);
      if (uploadError) { flash(file.name + ": " + uploadError.message); continue; }
      const { error: dbError } = await supabase.from("crm_documents").insert({
        board_item_id: linkId || null,
        file_name: file.name,
        file_path: path,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        uploaded_by: session.user.id,
      });
      if (dbError) { flash(file.name + ": " + dbError.message); continue; }
      succeeded++;
    }
    await loadDocuments();
    if (fileInputRef.current) fileInputRef.current.value = "";
    flash(succeeded === 1 ? "Document uploaded" : succeeded + " documents uploaded");
  }, [session, isViewer, supabase, loadDocuments, flash, linkId]);

  const deleteDocument = useCallback(async (doc: CrmDocument) => {
    if (!confirm("Delete this document? This can't be undone.")) return;
    await supabase.storage.from("crm-documents").remove([doc.file_path]);
    await supabase.from("crm_documents").delete().eq("id", doc.id);
    await loadDocuments();
    if (previewDoc?.id === doc.id) { setPreviewDoc(null); setPreviewUrl(null); }
    flash("Document deleted");
  }, [supabase, loadDocuments, previewDoc, setPreviewDoc, flash]);

  const openPreview = useCallback(async (doc: CrmDocument) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    const { data, error } = await supabase.storage.from("crm-documents").createSignedUrl(doc.file_path, 300);
    if (error) { flash(error.message); return; }
    setPreviewUrl(data.signedUrl);
  }, [supabase, setPreviewDoc, flash]);

  return (
    <>
      <div className="board-scroll overflow-auto min-h-0">
        <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
          {!isViewer && (
            <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
              <h2 className="m-0 text-[15px]">Upload a document</h2>
              <div
                className="border-2 border-dashed border-crm-line rounded-[var(--radius,8px)] p-[22px] text-center text-crm-muted text-[13px] grid gap-2 justify-items-center cursor-pointer bg-crm-panel-strong"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-[rgba(15,118,110,.06)]"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("bg-[rgba(15,118,110,.06)]"); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("bg-[rgba(15,118,110,.06)]"); uploadDocuments(e.dataTransfer.files); }}
              >
                <strong className="text-crm-text">Drag & drop files here, or click to browse</strong>
                <span>PDF, images, and office documents up to 20 MB each &mdash; select as many as you need</span>
              </div>
              <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => uploadDocuments(e.target.files)} />
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Link to account or project
                <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                  <option value="">No linked account</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.company} - {item.title}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
            <div className="flex gap-2 flex-wrap items-center">
              <h2 className="m-0 text-[15px] flex-1">Files ({filteredDocs.length})</h2>
              <select value={docFilterItem} onChange={(e) => setDocFilterItem(e.target.value)}
                className="h-[32px] w-auto" aria-label="Filter by linked account">
                <option value="all">All accounts</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.company} - {item.title}</option>
                ))}
              </select>
            </div>
            <div className="doc-grid grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 max-md:grid-cols-1">
              {filteredDocs.length === 0 ? (
                <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4 col-span-full">
                  No documents yet. {isViewer ? "Sign in to upload files." : "Upload the first file above."}
                </div>
              ) : filteredDocs.map((doc) => {
                const item = items.find((i) => i.id === doc.board_item_id);
                const canDelete = session && (isManager || doc.uploaded_by === session.user.id);
                return (
                  <div key={doc.id} className="border border-crm-line rounded-[var(--radius,8px)] p-3 bg-crm-panel grid gap-2 animate-[fadeIn_0.3s_ease_both] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(15,23,42,.1)] transition-[transform,box-shadow] duration-150">
                    <div className="w-[36px] h-[36px] rounded-[8px] bg-crm-panel-strong grid place-items-center text-[16px]">{docIcon(doc.file_type)}</div>
                    <h3 className="m-0 text-[13px] leading-[1.3] break-words">{doc.file_name}</h3>
                    <span className="text-crm-muted text-[11px]">{item ? item.company : "No linked account"}</span>
                    <span className="text-crm-muted text-[11px]">{formatBytes(doc.file_size)} &middot; {dateLabel((doc.created_at || "").slice(0, 10))}</span>
                    <div className="flex gap-2 items-center">
                      <button type="button" onClick={() => openPreview(doc)} className="text-[12px] min-h-auto py-1 px-2">Preview</button>
                      {canDelete && <button type="button" onClick={() => deleteDocument(doc)} className="w-[28px] min-h-[28px] text-crm-rose ml-auto">&times;</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {previewDoc && previewUrl && (
        <div className="fixed inset-0 bg-[rgba(15,23,42,.55)] grid place-items-center z-50 p-5 animate-[overlayFadeIn_0.18s_ease_both]"
          onClick={(e) => { if (e.target === e.currentTarget) { setPreviewDoc(null); setPreviewUrl(null); } }}>
          <div className="w-full max-w-[720px] max-h-[88vh] bg-crm-panel rounded-[10px] shadow-[0_12px_30px_rgba(15,23,42,.08)] grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden animate-[modalPopIn_0.22s_cubic-bezier(.16,1,.3,1)_both]">
            <div className="p-[14px_16px] border-b border-crm-line flex justify-between items-center gap-[10px]">
              <h2 className="m-0 text-[15px] break-words">{previewDoc.file_name}</h2>
              <button onClick={() => { setPreviewDoc(null); setPreviewUrl(null); }} className="w-[34px] h-[34px] grid place-items-center p-0">&times;</button>
            </div>
            <div className="p-4 overflow-auto grid gap-3 justify-items-center">
              {renderPreviewBody(previewUrl, previewDoc)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function renderPreviewBody(url: string, doc: CrmDocument) {
  const fileType = doc.file_type || "";
  const extension = (doc.file_name.split(".").pop() || "").toLowerCase();
  if (fileType.startsWith("image/")) return <img src={url} alt={doc.file_name} className="max-w-full max-h-[60vh] rounded-[6px]" />;
  if (fileType.includes("pdf")) return <iframe src={url} title={doc.file_name} className="w-full h-[60vh] border border-crm-line rounded-[6px]" />;
  if (fileType.startsWith("video/")) return <video controls src={url} className="max-w-full max-h-[60vh]" />;
  if (fileType.startsWith("audio/")) return <audio controls src={url} className="w-full" />;
  if (fileType.startsWith("text/") || TEXT_PREVIEW_EXTENSIONS.includes(extension)) {
    return <span className="text-[12px] text-crm-muted">Text preview loading...</span>;
  }
  if (OFFICE_PREVIEW_TYPES.includes(fileType) || ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) {
    const viewerUrl = "https://docs.google.com/viewer?url=" + encodeURIComponent(url) + "&embedded=true";
    return <iframe src={viewerUrl} title={doc.file_name} className="w-full h-[60vh] border border-crm-line rounded-[6px]" />;
  }
  return (
    <div className="text-center grid gap-3">
      <div className="text-crm-muted">Preview is not available for this file type.</div>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <button className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3">Download {doc.file_name}</button>
      </a>
    </div>
  );
}
