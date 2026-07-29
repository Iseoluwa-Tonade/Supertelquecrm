"use client";

import { useApp } from "@/lib/AppContext";
import { useToast } from "@/components/Toast";
import { useCallback, useRef, useState } from "react";
import { label, formatBytes, docIcon, dateLabel } from "@/lib/utils";
import type { CrmDocument } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelHead, PageHeader, Tag, Btn } from "@/components/kit.launchpad";

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title="Documents"
        desc="Upload, preview and manage files linked to your deals and projects."
      />

      {!isViewer && (
        <Panel>
          <PanelHead title="Upload a document" />
          <div className="p-4 space-y-3">
            <div
              className="cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:bg-surface-raised"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--color-primary)"; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = ""; uploadDocuments(e.dataTransfer.files); }}
            >
              <p className="font-medium text-foreground">Drag & drop files here, or click to browse</p>
              <p className="mt-1">PDF, images, and office documents up to 20 MB each</p>
            </div>
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => uploadDocuments(e.target.files)} />
            <label className="block space-y-1.5">
              <span className="label-tag text-muted-foreground">Link to account or project</span>
              <select value={linkId} onChange={(e) => setLinkId(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                <option value="">No linked account</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.company} - {item.title}</option>
                ))}
              </select>
            </label>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHead
          title={`Files (${filteredDocs.length})`}
          action={
            <select value={docFilterItem} onChange={(e) => setDocFilterItem(e.target.value)} className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60" aria-label="Filter by linked account">
              <option value="all">All accounts</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.company} - {item.title}</option>
              ))}
            </select>
          }
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDocs.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No documents yet. {isViewer ? "Sign in to upload files." : "Upload the first file above."}
            </div>
          ) : filteredDocs.map((doc) => {
            const item = items.find((i) => i.id === doc.board_item_id);
            const canDelete = session && (isManager || doc.uploaded_by === session.user.id);
            return (
              <div key={doc.id} className="rounded-lg border border-border bg-surface p-3 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-raised text-base">{docIcon(doc.file_type)}</div>
                <p className="mt-2 text-sm font-medium text-foreground break-words">{doc.file_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item ? item.company : "No linked account"}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(doc.file_size)} &middot; {dateLabel((doc.created_at || "").slice(0, 10))}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Btn size="sm" onClick={() => openPreview(doc)}>Preview</Btn>
                  {canDelete && (
                    <Btn size="sm" variant="danger" onClick={() => deleteDocument(doc)} className="ml-auto">
                      &times;
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {previewDoc && previewUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-5" onClick={(e) => { if (e.target === e.currentTarget) { setPreviewDoc(null); setPreviewUrl(null); } }}>
          <div className="w-full max-w-[720px] max-h-[88vh] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="truncate text-sm font-semibold text-foreground">{previewDoc.file_name}</h2>
              <Btn size="sm" onClick={() => { setPreviewDoc(null); setPreviewUrl(null); }}>&times;</Btn>
            </div>
            <div className="grid gap-3 justify-items-center overflow-auto p-4">
              {renderPreviewBody(previewUrl, previewDoc)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderPreviewBody(url: string, doc: CrmDocument) {
  const fileType = doc.file_type || "";
  const extension = (doc.file_name.split(".").pop() || "").toLowerCase();
  if (fileType.startsWith("image/")) return <img src={url} alt={doc.file_name} className="max-h-[60vh] max-w-full rounded-md" />;
  if (fileType.includes("pdf")) return <iframe src={url} title={doc.file_name} className="h-[60vh] w-full rounded-md border border-border" />;
  if (fileType.startsWith("video/")) return <video controls src={url} className="max-h-[60vh] max-w-full" />;
  if (fileType.startsWith("audio/")) return <audio controls src={url} className="w-full" />;
  if (fileType.startsWith("text/") || TEXT_PREVIEW_EXTENSIONS.includes(extension)) {
    return <span className="text-xs text-muted-foreground">Text preview loading...</span>;
  }
  if (OFFICE_PREVIEW_TYPES.includes(fileType) || ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) {
    const viewerUrl = "https://docs.google.com/viewer?url=" + encodeURIComponent(url) + "&embedded=true";
    return <iframe src={viewerUrl} title={doc.file_name} className="h-[60vh] w-full rounded-md border border-border" />;
  }
  return (
    <div className="grid gap-3 text-center">
      <p className="text-sm text-muted-foreground">Preview is not available for this file type.</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Btn variant="primary">Download {doc.file_name}</Btn>
      </a>
    </div>
  );
}
