"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState } from "react";
import { label, dateLabel, formatChangeValue, money } from "@/lib/utils";

const supabase = createClient();

export default function ApprovalsPage() {
  const { session, profile, changeRequests, items, loadChangeRequests, loadRemoteItems } = useApp();
  const { flash } = useToast();

  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const myId = session?.user?.id;

  const pending = changeRequests.filter((r) => r.status === "pending");

  const reviewRequest = useCallback(async (id: string, decision: "approved" | "rejected") => {
    const req = changeRequests.find((r) => r.id === id);
    if (!req) return;
    try {
      if (decision === "approved") {
        if (req.action === "create") {
          await supabase.from("crm_board_items").insert(req.payload);
        } else if (req.action === "update") {
          await supabase.from("crm_board_items").update(req.payload).eq("id", req.board_item_id);
        } else if (req.action === "delete") {
          await supabase.from("crm_board_items").delete().eq("id", req.board_item_id);
        }
      }
      await supabase.from("crm_change_requests").update({
        status: decision,
        reviewed_by: myId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      await loadChangeRequests();
      await loadRemoteItems();
      flash(decision === "approved" ? "Approved" : "Rejected");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Error");
    }
  }, [changeRequests, myId, loadChangeRequests, loadRemoteItems, flash]);

  const cancelRequest = useCallback(async (id: string) => {
    const req = changeRequests.find((r) => r.id === id);
    if (!req || req.requested_by !== myId) return;
    await supabase.from("crm_change_requests").update({ status: "cancelled" }).eq("id", id);
    await loadChangeRequests();
    flash("Request withdrawn");
  }, [changeRequests, myId, loadChangeRequests, flash]);

  return (
    <div className="board-scroll overflow-auto min-h-0">
      <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">{isManager ? "Pending Team Edits" : "My Pending Edits"}</h2>
          <div className="approval-list grid gap-[10px]">
            {pending.length === 0 ? (
              <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">
                {isManager ? "No team edits are waiting for approval." : "You do not have pending edits right now."}
              </div>
            ) : pending.map((req) => {
              const item = items.find((i) => i.id === req.board_item_id);
              const title = (req.payload?.title as string) || item?.title || "New CRM item";
              const company = (req.payload?.company as string) || item?.company || "Pending account";
              const action = label(req.action);
              const isOwn = req.requested_by === myId;
              return (
                <div key={req.id} className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(15,23,42,.1)] transition-[transform,box-shadow] duration-150">
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <h3 className="m-0 text-[15px]">{company} - {title}</h3>
                      <p className="m-[4px_0_0] text-crm-muted text-[12px]">{action} requested by {isOwn ? "You" : (req.requested_by || "").slice(0, 8) + "..."} on {dateLabel((req.requested_at || "").slice(0, 10))}</p>
                    </div>
                    <span className="inline-flex items-center h-[23px] rounded-[12px] px-2 text-[12px] bg-[#eef2f7] text-[#405266] dark:bg-[#1f2937] dark:text-[#cbd5e1] whitespace-nowrap">
                      {label(req.status)}
                    </span>
                  </div>

                  <div className="grid gap-[7px] text-[12px]">
                    {req.action === "delete" ? (
                      <div className="grid grid-cols-[minmax(80px,130px)_minmax(0,1fr)] gap-[10px] border border-crm-line rounded-[7px] p-[8px_10px] items-center">
                        <strong className="text-crm-muted text-[12px]">Delete</strong>
                        <span>{(req.before_payload?.company as string || "Account")} - {(req.before_payload?.title as string || "CRM item")}</span>
                      </div>
                    ) : ["title", "company", "owner", "type", "priority", "status", "value", "due", "notes", "document_url"].map((key) => {
                      if (key === "value" && !isAdmin) return null;
                      const before = req.before_payload?.[key];
                      const after = req.payload?.[key];
                      if (req.action === "update" && String(before ?? "") === String(after ?? "")) return null;
                      return (
                        <div key={key} className="grid grid-cols-[minmax(80px,130px)_minmax(0,1fr)] gap-[10px] border border-crm-line rounded-[7px] p-[8px_10px] items-center">
                          <strong className="text-crm-muted text-[12px]">{label(key)}</strong>
                          <span>{formatChangeValue(before)} -&gt; {formatChangeValue(after)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {isManager ? (
                    <div className="flex justify-end gap-2 flex-wrap">
                      {isOwn && <button onClick={() => cancelRequest(req.id)}>Withdraw</button>}
                      <button onClick={() => reviewRequest(req.id, "rejected")} className="text-crm-rose border-[#fecdd3]">Reject</button>
                      <button onClick={() => reviewRequest(req.id, "approved")}
                        className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3">
                        Approve
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end gap-2 flex-wrap">
                        {isOwn && <button onClick={() => cancelRequest(req.id)}>Withdraw</button>}
                      </div>
                      <div className="border border-[#fde68a] bg-[#fffbeb] text-[#92400e] dark:bg-[rgba(251,191,36,.1)] dark:border-[rgba(251,191,36,.35)] dark:text-[#fcd34d] rounded-[7px] p-[10px] text-[12px] leading-[1.4]">
                        Waiting for manager approval. The approved board will not change until this is reviewed.
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
