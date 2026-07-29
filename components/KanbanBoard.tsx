"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { PIPELINE_COLUMNS, PROJECT_COLUMNS, FOCUS_COLUMNS } from "@/lib/types";
import type { Column, BoardItem } from "@/lib/types";
import { label, money, daysUntil, dueLabel, normalizeStatus } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useCallback, useState, useRef } from "react";
import DetailPanel from "@/components/DetailPanel";
import { Btn, Tag, Avatar } from "@/components/kit.launchpad";

const supabase = createClient();

export default function KanbanBoard({ view }: { view: "pipeline" | "projects" | "focus" }) {
  const {
    items, session, profile, changeRequests, documents, search, type, owner, priority,
    selectedId, setSelectedId, setType, setOwner, setPriority, loadRemoteItems,
  } = useApp();
  const { flash } = useToast();
  const dragItem = useRef<string | null>(null);

  const role = profile?.role;
  const isManager = role === "manager" || role === "admin";
  const isViewer = role === "viewer";

  const activeColumns = view === "focus" ? FOCUS_COLUMNS
    : view === "projects" ? PROJECT_COLUMNS
    : PIPELINE_COLUMNS;

  const filteredItems = items.filter((item) => {
    if (view === "pipeline" && item.type !== "deal") return false;
    if (view === "projects" && item.type !== "project") return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase()) && !item.company.toLowerCase().includes(search.toLowerCase())) return false;
    if (type && item.type !== type) return false;
    if (owner && item.owner !== owner) return false;
    if (priority && item.priority !== priority) return false;
    return true;
  });

  const columnFilter = (item: BoardItem, colId: string) => {
    const normalized = normalizeStatus(item.status);
    if (view === "focus") {
      const days = daysUntil(item.due);
      if (colId === "overdue") return days < 0;
      if (colId === "due_soon") return days >= 0 && days <= 3;
      if (colId === "this_week") return days > 3 && days <= 7;
      if (colId === "on_track") return days > 7;
      return true;
    }
    return normalized === colId;
  };

  const handleDrop = useCallback(async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const itemId = dragItem.current;
    if (!itemId) return;
    dragItem.current = null;
    const item = filteredItems.find((i) => i.id === itemId);
    if (!item || isViewer) return;

    if (isManager) {
      const { error } = await supabase
        .from("crm_board_items")
        .update({ status: colId })
        .eq("id", itemId);
      if (error) { flash(error.message); return; }
      await loadRemoteItems();
    } else {
      const payload: Record<string, unknown> = { status: colId };
      const pending = changeRequests.filter((r) => r.board_item_id === itemId && r.status === "pending");
      if (pending.length > 0) { flash("There's already a pending change request for this item"); return; }
      const { error } = await supabase.from("crm_change_requests").insert({
        board_item_id: itemId,
        action: "update",
        before_payload: { status: item.status },
        payload,
      });
      if (error) { flash(error.message); return; }
      flash("Change request submitted for review");
    }
  }, [filteredItems, isViewer, isManager, supabase, loadRemoteItems, flash, changeRequests]);

  const createItem = useCallback(async (colId: string) => {
    if (!session) { flash("Sign in to create items"); return; }
    if (isViewer) { flash("Viewers have read-only access"); return; }
    const owner = profile?.display_name || session.user.email || "User";
    if (isManager) {
      const { error } = await supabase.from("crm_board_items").insert({
        title: "New " + view.slice(0, -1),
        type: view === "pipeline" ? "deal" : "project",
        company: "New account",
        status: colId,
        owner,
      });
      if (error) { flash(error.message); return; }
      await loadRemoteItems();
    } else {
      const payload = {
        title: "New " + view.slice(0, -1),
        type: view === "pipeline" ? "deal" : "project",
        company: "New account",
        status: colId,
        owner,
      };
      const pending = changeRequests.filter((r) => r.status === "pending");
      if (pending.length > 0) { flash("You already have a pending change request"); return; }
      const { error } = await supabase.from("crm_change_requests").insert({
        action: "create",
        payload,
      });
      if (error) { flash(error.message); return; }
      flash("Create request submitted for review");
    }
  }, [session, isViewer, isManager, view, profile, supabase, loadRemoteItems, flash, changeRequests]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5 max-md:flex-col max-md:items-stretch">
        <div className="inline-grid grid-flow-col overflow-hidden rounded-lg border border-border" role="tablist">
          {["all", ...new Set(items.map((i) => i.type))].map((t) => (
            <button key={t} onClick={() => setType(t === "all" ? "" : t)}
              className={`rounded-none border-0 px-3 py-1.5 text-xs font-medium transition-colors ${
                (type === t) || (t === "all" && !type)
                  ? "bg-surface-raised text-foreground shadow-[inset_0_-2px_0_var(--color-primary)]"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {label(t)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60" aria-label="Filter by owner">
            <option value="">All owners</option>
            {[...new Set(items.map((i) => i.owner))].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60" aria-label="Filter by priority">
            <option value="">All priorities</option>
            {["high", "medium", "low"].map((p) => <option key={p} value={p}>{label(p)}</option>)}
          </select>
        </div>
      </section>

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {activeColumns.map((col) => {
          const colItems = filteredItems.filter((item) => columnFilter(item, col.id));
          return (
            <article key={col.id} className="flex min-w-[260px] max-w-[320px] flex-1 flex-col rounded-xl border border-border bg-surface/70">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: col.color || "var(--color-muted-foreground)" }} />
                  <span className="text-sm font-medium text-foreground">{col.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-raised px-1.5 text-xs text-muted-foreground">{colItems.length}</span>
                  {!isViewer && <button onClick={() => createItem(col.id)} className="grid h-6 w-6 place-items-center rounded text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground">+</button>}
                </div>
              </div>
              <div
                className="flex flex-col gap-2 overflow-y-auto p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {colItems.map((item) => {
                  const pending = changeRequests.filter((r) => r.board_item_id === item.id && r.status === "pending").length;
                  return (
                    <div
                      key={item.id}
                      draggable={!isViewer}
                      onDragStart={() => { dragItem.current = item.id; }}
                      onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                      className={`cursor-pointer rounded-lg border bg-surface p-3 shadow-sm transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                        item.id === selectedId ? "border-primary shadow-[0_0_0_2px_var(--color-primary)/.16]" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {view !== "focus" && <p className="text-xs text-muted-foreground">{item.company}</p>}
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                        </div>
                        <Avatar initials={(item.owner || "U").slice(0, 2).toUpperCase()} size="sm" />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Tag tone={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "success"}>
                          {item.priority}
                        </Tag>
                        {isManager ? (
                          <span className="num text-sm text-foreground">{money(item.value)}</span>
                        ) : (
                          <span className="num text-xs text-muted-foreground">{dueLabel(item.due)}</span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.owner}</span>
                        <span className="num">{dueLabel(item.due)}</span>
                      </div>

                      {pending > 0 && (
                        <div className="mt-1.5 rounded bg-warning/10 px-2 py-1 text-[10px] text-warning">
                          {pending} pending change{pending > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {selectedId && <DetailPanel />}
    </div>
  );
}
