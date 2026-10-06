"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState } from "react";
import { label, dateLabel, formatChangeValue, money } from "@/lib/utils";
import { Panel, PanelHead, PageHeader, Tag, Btn } from "@/components/kit.launchpad";

const supabase = createClient();

export default function ApprovalsPage() {
  const { session, profile, organisation, changeRequests, items, loadChangeRequests, loadRemoteItems } = useApp();
  const { flash } = useToast();

  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const myId = session?.user?.id;

  const pending = changeRequests.filter((r) => r.status === "pending");

  const reviewRequest = useCallback(async (id: string, decision: "approved" | "rejected") => {
    const req = changeRequests.find((r) => r.id === id);
    if (!req || !myId || !organisation?.id) return;

    try {
      if (decision === "approved") {
        if (req.action === "create") {
          const payload = req.payload || {};
          const { error } = await supabase.from("crm_board_items").insert({
            organisation_id: organisation.id,
            user_id: myId,
            assigned_to: (payload.assigned_to as string) || req.requested_by || myId,
            visibility: (payload.visibility as string) || "team",
            type: (payload.type as string) || "task",
            title: (payload.title as string) || "New CRM item",
            company: (payload.company as string) || "General",
            owner: (payload.owner as string) || profile?.display_name || profile?.email || "CRM",
            priority: (payload.priority as string) || "medium",
            value: Number(payload.value || 0),
            due: (payload.due as string) || null,
            status: (payload.status as string) || "open",
            notes: (payload.notes as string) || "",
            document_url: (payload.document_url as string) || "",
          });
          if (error) throw error;
        } else if (req.action === "update") {
          const { error } = await supabase
            .from("crm_board_items")
            .update(req.payload)
            .eq("id", req.board_item_id)
            .eq("organisation_id", organisation.id);
          if (error) throw error;
        } else if (req.action === "delete") {
          const { error } = await supabase
            .from("crm_board_items")
            .delete()
            .eq("id", req.board_item_id)
            .eq("organisation_id", organisation.id);
          if (error) throw error;
        }
      }

      const { error: reviewError } = await supabase
        .from("crm_change_requests")
        .update({
          status: decision,
          reviewed_by: myId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organisation_id", organisation.id);

      if (reviewError) throw reviewError;

      await Promise.all([loadChangeRequests(), loadRemoteItems()]);
      flash(decision === "approved" ? "Approved and applied" : "Rejected");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Could not review request");
    }
  }, [changeRequests, myId, organisation?.id, profile?.display_name, profile?.email, loadChangeRequests, loadRemoteItems, flash]);

  const cancelRequest = useCallback(async (id: string) => {
    const req = changeRequests.find((r) => r.id === id);
    if (!req || req.requested_by !== myId) return;
    const { error } = await supabase
      .from("crm_change_requests")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("requested_by", myId);
    if (error) { flash(error.message); return; }
    await loadChangeRequests();
    flash("Request withdrawn");
  }, [changeRequests, myId, loadChangeRequests, flash]);

  return (
    <div className="space-y-6">
      <PageHeader variant="operations"
        eyebrow="Operations"
        title="Approvals"
        desc={isManager ? "Review and approve pending change requests from the team." : "Track your pending change requests."}
      />

      <Panel>
        <PanelHead title={isManager ? "Pending team edits" : "My pending edits"} />
        <div className="divide-y divide-border">
          {pending.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isManager ? "No team edits are waiting for approval." : "You do not have pending edits right now."}
            </div>
          ) : pending.map((req) => {
            const item = items.find((i) => i.id === req.board_item_id);
            const title = (req.payload?.title as string) || item?.title || "New CRM item";
            const company = (req.payload?.company as string) || item?.company || "Pending account";
            const action = label(req.action);
            const isOwn = req.requested_by === myId;
            return (
              <div key={req.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{company} - {title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{action} requested by {isOwn ? "You" : (req.requested_by || "").slice(0, 8) + "..."} on {dateLabel((req.requested_at || "").slice(0, 10))}</p>
                  </div>
                  <Tag tone="warning">{label(req.status)}</Tag>
                </div>

                <div className="grid gap-1.5 text-xs">
                  {req.action === "delete" ? (
                    <div className="grid grid-cols-[100px_1fr] gap-2 rounded-lg border border-border bg-surface p-2">
                      <span className="text-muted-foreground">Delete</span>
                      <span>{(req.before_payload?.company as string || "Account")} - {(req.before_payload?.title as string || "CRM item")}</span>
                    </div>
                  ) : ["title", "company", "owner", "type", "priority", "status", "value", "due", "notes", "document_url"].map((key) => {
                    if (key === "value" && !isAdmin) return null;
                    const before = req.before_payload?.[key];
                    const after = req.payload?.[key];
                    if (req.action === "update" && String(before ?? "") === String(after ?? "")) return null;
                    return (
                      <div key={key} className="grid grid-cols-[100px_1fr] gap-2 rounded-lg border border-border bg-surface p-2">
                        <span className="text-muted-foreground">{label(key)}</span>
                        <span>{formatChangeValue(before)} &rarr; {formatChangeValue(after)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2 flex-wrap">
                  {isOwn && <Btn size="sm" onClick={() => cancelRequest(req.id)}>Withdraw</Btn>}
                  {isManager && (
                    <>
                      <Btn size="sm" variant="danger" onClick={() => reviewRequest(req.id, "rejected")}>Reject</Btn>
                      <Btn size="sm" variant="primary" onClick={() => reviewRequest(req.id, "approved")}>Approve</Btn>
                    </>
                  )}
                  {!isManager && !isOwn && (
                    <div className="w-full rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                      Waiting for manager approval.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
