"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Save, Trash2 } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { PIPELINE_COLUMNS, PROJECT_COLUMNS } from "@/lib/types";
import { label, money, dueLabel, formatBytes } from "@/lib/utils";
import { Btn, Field, Input, PageHeader, Panel, PanelHead, Tag, DropdownSelect } from "@/components/kit.launchpad";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";

const supabase = createClient();

type ItemKind = "deal" | "project" | "task";

const TASK_COLUMNS = [
  { id: "open", title: "Open" },
  { id: "in_progress", title: "In progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

export function BoardItemPage({ kind }: { kind: ItemKind }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { flash } = useToast();
  const {
    items,
    profile,
    organisation,
    session,
    documents,
    changeRequests,
    loadRemoteItems,
    loadChangeRequests,
  } = useApp();

  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const item = items.find((row) => row.id === id && row.type === kind);
  const role = profile?.role || "viewer";
  const isManager = role === "admin" || role === "manager";
  const isViewer = role === "viewer";
  const linkedDocs = documents.filter((doc) => doc.board_item_id === id);
  const pending = changeRequests.filter((req) => req.board_item_id === id && req.status === "pending");

  const columns =
    kind === "deal" ? PIPELINE_COLUMNS :
    kind === "project" ? PROJECT_COLUMNS :
    TASK_COLUMNS;

  const backHref = kind === "deal" ? "/pipeline" : kind === "project" ? "/projects" : "/tasks";
  const title = kind === "deal" ? "Deal" : kind === "project" ? "Project" : "Task";

  if (!item) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="CRM record" title={title} desc="This record could not be found or you do not have permission to view it." />
        <Link href={backHref}><Btn><ArrowLeft className="h-4 w-4" /> Back</Btn></Link>
      </div>
    );
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || isViewer) return;

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      title: String(form.get("title") || "").trim(),
      company: String(form.get("company") || "").trim(),
      owner: String(form.get("owner") || "").trim(),
      priority: String(form.get("priority") || "medium"),
      status: String(form.get("status") || item.status),
      due: String(form.get("due") || ""),
      notes: String(form.get("notes") || ""),
      value: Number(form.get("value") || 0),
    };

    if (isManager) {
      const { error } = await supabase
        .from("crm_board_items")
        .update(payload)
        .eq("id", item.id);
      if (error) return flash(error.message);
      await loadRemoteItems();
      flash(title + " updated");
      return;
    }

    if (pending.length) {
      flash("A change request is already waiting for review");
      return;
    }

    const { error } = await supabase.from("crm_change_requests").insert({
      organisation_id: organisation?.id,
      board_item_id: item.id,
      action: "update",
      requested_by: session.user.id,
      before_payload: {
        title: item.title,
        company: item.company,
        owner: item.owner,
        priority: item.priority,
        status: item.status,
        due: item.due,
        notes: item.notes,
        value: item.value,
      },
      payload,
      status: "pending",
    });
    if (error) return flash(error.message);
    await loadChangeRequests();
    flash("Change request sent for approval");
  }

  async function deleteItem() {
    if (!session || isViewer) return;
    if (!window.confirm("Delete this record?")) return;

    if (isManager) {
      const { error } = await supabase.from("crm_board_items").delete().eq("id", item.id);
      if (error) return flash(error.message);
      await loadRemoteItems();
      router.push(backHref);
      return;
    }

    if (pending.length) {
      flash("A change request is already waiting for review");
      return;
    }

    const { error } = await supabase.from("crm_change_requests").insert({
      organisation_id: organisation?.id,
      board_item_id: item.id,
      action: "delete",
      requested_by: session.user.id,
      before_payload: { title: item.title, company: item.company },
      payload: {},
      status: "pending",
    });
    if (error) return flash(error.message);
    await loadChangeRequests();
    flash("Delete request sent for approval");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to {backHref.slice(1)}
        </Link>
      </div>

      <PageHeader
        variant={kind === "deal" ? "revenue" : "delivery"}
        eyebrow={title}
        title={item.title}
        desc={item.company || "CRM record"}
        actions={<Tag tone={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "neutral"}>{label(item.priority)}</Tag>}
      />

      {pending.length > 0 && (
        <Panel className="border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {pending.length} change request{pending.length === 1 ? "" : "s"} waiting for review.
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
        <Panel>
          <PanelHead title={title + " details"} hint="Dedicated CRM record page" />
          <form onSubmit={saveItem} className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Title"><Input name="title" defaultValue={item.title} disabled={isViewer} /></Field>
            <Field label="Company"><Input name="company" defaultValue={item.company} disabled={isViewer} /></Field>
            <Field label="Owner"><Input name="owner" defaultValue={item.owner} disabled={isViewer} /></Field>
            <Field label="Due date"><Input name="due" type="date" defaultValue={item.due?.slice(0,10) || ""} disabled={isViewer} /></Field>
            <Field label="Priority">
              <DropdownSelect
                value={item.priority}
                onChange={() => {}}
                ariaLabel="Priority"
                options={["high","medium","low"].map((value) => ({ value, label: label(value) }))}
                className={isViewer ? "pointer-events-none opacity-70" : ""}
              />
              <input type="hidden" name="priority" value={item.priority} />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={item.status} disabled={isViewer} className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm">
                {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
              </select>
            </Field>
            {kind !== "task" && (
              <Field label="Value">
                <Input name="value" type="number" min="0" defaultValue={item.value || 0} disabled={isViewer} />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Notes">
                <textarea name="notes" defaultValue={item.notes || ""} disabled={isViewer} rows={6} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none" />
              </Field>
            </div>
            {!isViewer && (
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Btn type="button" variant="danger" onClick={deleteItem}><Trash2 className="h-4 w-4" /> Delete</Btn>
                <Btn type="submit" variant="primary"><Save className="h-4 w-4" /> Save</Btn>
              </div>
            )}
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHead title="Snapshot" />
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Status</span><span>{label(item.status)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Due</span><span>{dueLabel(item.due)}</span></div>
              {kind !== "task" && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Value</span><span className="num">{money(item.value || 0)}</span></div>}
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Visibility</span><span>{label(item.visibility || "team")}</span></div>
            </div>
          </Panel>

          <Panel>
            <PanelHead title={"Documents (" + linkedDocs.length + ")"} />
            <div className="space-y-2 p-4">
              {linkedDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked documents.</p>
              ) : linkedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{doc.file_name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
