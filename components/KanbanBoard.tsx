"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { PIPELINE_COLUMNS, PROJECT_COLUMNS, FOCUS_COLUMNS } from "@/lib/types";
import type { Column, BoardItem } from "@/lib/types";
import { label, money, daysUntil, dueLabel, normalizeStatus } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useCallback, useState, useRef } from "react";
import DetailPanel from "@/components/DetailPanel";

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
    const query = search.trim().toLowerCase();
    const typeOk = type === "all" || item.type === type;
    const ownerOk = owner === "all" || item.owner === owner;
    const priorityOk = priority === "all" || item.priority === priority;
    const viewOk = view !== "focus" || item.priority === "high" || daysUntil(item.due) <= 7;
    const text = [item.title, item.company, item.owner, item.notes, item.type].join(" ").toLowerCase();
    return typeOk && ownerOk && priorityOk && viewOk && (!query || text.includes(query));
  });

  function itemColumn(item: BoardItem): string {
    if (view === "focus") {
      const days = daysUntil(item.due);
      if (days < 0) return "overdue";
      if (days <= 7) return "soon";
      return "later";
    }
    const available = activeColumns.map((c) => c.id);
    if (available.includes(item.status)) return item.status;
    if (view === "projects") return item.type === "project" ? "project_build" : "project_brief";
    return item.type === "deal" ? "meeting_booked" : "responded_email";
  }

  const moveItem = useCallback(async (id: string, status: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (view === "focus") { flash("Cannot move items in Focus view"); return; }

    if (!isManager) {
      flash("Changes sent for approval (manager-only direct move)");
      return;
    }

    const { error } = await supabase.from("crm_board_items").update({ status }).eq("id", id);
    if (error) { flash(error.message); return; }
    await loadRemoteItems();
    flash("Moved");
  }, [items, isManager, view, loadRemoteItems, flash]);

  const addItem = useCallback(async () => {
    if (!session) { flash("Sign in first"); return; }
    if (isViewer) { flash("Viewers have read-only access"); return; }

    const status = view === "projects" ? "project_brief" : "responded_email";
    const newItem = {
      user_id: session.user.id,
      assigned_to: session.user.id,
      visibility: "personal",
      type: type === "all" ? "deal" : type,
      title: "New opportunity",
      company: "New account",
      owner: session.user.email?.split("@")[0] || "User",
      priority: "medium" as const,
      value: 0,
      due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status,
      notes: "",
      document_url: "",
    };

    if (!isManager) {
      flash("Sent for approval");
      return;
    }

    const { data, error } = await supabase.from("crm_board_items").insert(newItem).select().single();
    if (error) { flash(error.message); return; }
    await loadRemoteItems();
    if (data) setSelectedId(data.id);
    flash("Created");
  }, [session, isViewer, isManager, view, type, loadRemoteItems, setSelectedId, flash]);

  const owners = Array.from(new Set(items.map((item) => item.owner))).sort();

  return (
    <div className="board-scroll overflow-auto min-h-0 flex flex-col">
      <section className="toolbar bg-crm-panel border-b border-crm-line p-[10px_18px] flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div className="segmented inline-grid grid-flow-col border border-crm-line rounded-[7px] overflow-hidden bg-crm-panel-strong" role="tablist">
          {["all", "deal", "project", "task"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`border-0 rounded-none min-h-[32px] px-3 bg-transparent ${type === t ? "bg-crm-panel text-crm-text shadow-[inset_0_-2px_0_var(--color-crm-accent)]" : "text-crm-muted"}`}
            >
              {t === "all" ? "All" : `${t.charAt(0).toUpperCase()}${t.slice(1)}s`}
            </button>
          ))}
        </div>
        <div className="filters flex items-center gap-2 max-md:w-full max-md:flex-wrap">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="h-[32px]"
            aria-label="Owner filter"
          >
            <option value="all">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-[32px]" aria-label="Priority filter">
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </section>

      <section className="flex-1 p-[16px_18px] grid grid-flow-col auto-cols-[minmax(250px,1fr)] gap-[14px] items-start shrink-0 max-md:auto-cols-[minmax(248px,86vw)] max-md:p-3">
        {activeColumns.map((column) => {
          const columnItems = filteredItems.filter((item) => itemColumn(item) === column.id);
          return (
            <article key={column.id} className="bg-crm-panel-strong border border-crm-line rounded-[var(--radius,8px)] min-h-[300px] grid grid-rows-[auto_minmax(120px,1fr)] animate-[fadeInUp_0.3s_ease_both]">
              <div className="p-3 flex justify-between items-center border-b border-crm-line">
                <h2 className="m-0 text-[14px] flex items-center gap-[7px]">
                  <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: column.color }} />
                  {column.title}
                </h2>
                <span className="text-crm-muted bg-crm-panel border border-crm-line min-w-[28px] h-6 rounded-[12px] grid place-items-center text-[12px]">
                  {columnItems.length}
                </span>
              </div>
              <div
                className="p-[10px] grid gap-[10px] content-start min-h-[260px] transition-colors duration-150"
                onDragOver={(e) => { if (view !== "focus") { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("bg-[rgba(15,118,110,.04)]"); } }}
                onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("bg-[rgba(15,118,110,.04)]")}
                onDrop={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).classList.remove("bg-[rgba(15,118,110,.04)]");
                  const id = dragItem.current;
                  if (id) moveItem(id, column.id);
                  dragItem.current = null;
                }}
              >
                {columnItems.map((item) => (
                  <article
                    key={item.id}
                    draggable={view !== "focus"}
                    onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                    onDragStart={() => { dragItem.current = item.id; }}
                    className={`bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-3 shadow-[0_1px_0_rgba(15,23,42,.03)] cursor-grab min-w-0 animate-[fadeIn_0.3s_ease_both] transition-[transform,box-shadow,border-color] duration-150
                      hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(15,23,42,.1)] hover:border-[#a7b4c3]
                      active:cursor-grabbing active:translate-y-0 active:scale-[.98]
                      ${item.id === selectedId ? "border-crm-accent shadow-[0_0_0_2px_rgba(15,118,110,.16)]" : ""}
                    `}
                  >
                    <h3 className="m-0 text-[14px] leading-[1.25]">{item.title}</h3>
                    <div className="mt-[5px] text-crm-muted text-[12px] whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.company} &middot; {item.owner}
                    </div>
                    <div className="flex justify-between gap-[10px] mt-[11px] items-center">
                      <span className={`inline-flex items-center gap-[5px] h-[23px] rounded-[12px] px-2 text-[12px] whitespace-nowrap
                        ${item.priority === "high" ? "bg-[#fff1f2] text-crm-rose dark:bg-[rgba(251,113,133,.14)]" :
                          item.priority === "medium" ? "bg-[#fffbeb] text-crm-amber dark:bg-[rgba(251,191,36,.14)]" :
                          "bg-[#ecfdf5] text-crm-green dark:bg-[rgba(74,222,128,.14)]"}`}>
                        {label(item.priority)}
                      </span>
                      <span className="font-bold text-[13px]">
                        {role === "admin" && item.value ? money(item.value) : dueLabel(item.due)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-[10px] mt-[11px] items-center">
                      <span className="inline-flex items-center gap-[5px] h-[23px] rounded-[12px] px-2 text-[12px] bg-[#eef2f7] text-[#405266] dark:bg-[#1f2937] dark:text-[#cbd5e1] whitespace-nowrap">
                        {label(item.type)}
                      </span>
                      <span className="inline-flex items-center gap-[5px] h-[23px] rounded-[12px] px-2 text-[12px] bg-[#eef2f7] text-[#405266] dark:bg-[#1f2937] dark:text-[#cbd5e1] whitespace-nowrap">
                        {dueLabel(item.due)}
                      </span>
                    </div>
                    {changeRequests.filter((r) => r.board_item_id === item.id && r.status === "pending").length > 0 && (
                      <div className="flex justify-between gap-[10px] mt-[11px] items-center">
                        <span className="inline-flex items-center gap-[5px] h-[23px] rounded-[12px] px-2 text-[12px] bg-[#fffbeb] text-crm-amber dark:bg-[rgba(251,191,36,.14)] whitespace-nowrap">
                          {changeRequests.filter((r) => r.board_item_id === item.id && r.status === "pending").length} pending approval
                        </span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
