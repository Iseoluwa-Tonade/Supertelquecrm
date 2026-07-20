"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState } from "react";
import { label } from "@/lib/utils";
import { ROLES, NAV_VIEWS } from "@/lib/types";

const supabase = createClient();

export default function TeamPage() {
  const { session, profile, teamProfiles, setInviteFormOpen, inviteFormOpen,
    loadTeamProfiles, setMessageThreadWith, setMessageThreadEmail, loadRemoteItems } = useApp();
  const { flash } = useToast();
  const [viewsOpenId, setViewsOpenId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("owner");
  const [inviting, setInviting] = useState(false);

  const isManager = profile?.role === "manager" || profile?.role === "admin";

  const inviteUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const { error } = await supabase.functions.invoke("invite-user", {
      body: { email: inviteEmail.trim(), role: inviteRole },
    });
    setInviting(false);
    if (error) { flash(error.message); return; }
    setInviteFormOpen(false);
    setInviteEmail("");
    await loadTeamProfiles();
    flash("Invite sent to " + inviteEmail);
  }, [inviteEmail, inviteRole, supabase, loadTeamProfiles, flash, setInviteFormOpen]);

  const updateRole = useCallback(async (userId: string, role: string) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("user_id", userId);
    if (error) { flash(error.message); return; }
    await loadTeamProfiles();
    flash("Role updated");
  }, [supabase, loadTeamProfiles, flash]);

  const updateStatus = useCallback(async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("user_id", userId);
    if (error) { flash(error.message); return; }
    await loadTeamProfiles();
    flash(nextStatus === "suspended" ? "Teammate suspended" : "Teammate reinstated");
  }, [supabase, loadTeamProfiles, flash]);

  const updateViews = useCallback(async (userId: string, views: string[]) => {
    const value = views.length ? views : null;
    const { error } = await supabase.from("profiles").update({ allowed_views: value }).eq("user_id", userId);
    if (error) { flash(error.message); return; }
    await loadTeamProfiles();
    if (userId === session?.user?.id) await loadRemoteItems();
    flash("Access updated");
  }, [supabase, session, loadTeamProfiles, loadRemoteItems, flash]);

  const myId = session?.user?.id;

  if (!isManager) {
    return (
      <div className="board-scroll overflow-auto min-h-0">
        <section className="overview p-[16px_18px]">
          <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">
            Only managers and admins can manage the team.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="board-scroll overflow-auto min-h-0">
      <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="m-0 text-[15px]">Teammates ({teamProfiles.length})</h2>
            <button onClick={() => setInviteFormOpen(!inviteFormOpen)}
              className="min-h-[34px] rounded-[6px] px-3">{inviteFormOpen ? "Cancel" : "Invite user"}</button>
          </div>

          {inviteFormOpen && (
            <form onSubmit={inviteUser} className="grid gap-3 p-4 bg-crm-panel border border-crm-line rounded-[var(--radius,8px)]">
              <div className="grid grid-cols-[1fr_auto] gap-[10px]">
                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Email address
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com" required />
                </label>
                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Role
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="submit" disabled={inviting}
                  className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3 disabled:bg-crm-panel-strong disabled:text-crm-muted disabled:border-crm-line disabled:cursor-not-allowed">
                  {inviting ? "Sending..." : "Send invite"}
                </button>
              </div>
            </form>
          )}

          <div className="team-table grid gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_170px] max-md:grid-cols-1 gap-[10px] items-center border border-crm-line rounded-[7px] p-[9px_10px] text-[12px] bg-crm-panel-strong text-crm-muted font-bold">
              <span>Email</span><span>Role</span><span>Status</span><span></span>
            </div>
            {teamProfiles.map((p) => {
              const isSelf = p.user_id === myId;
              const viewsOpen = viewsOpenId === p.user_id;
              const restricted = Array.isArray(p.allowed_views) && p.allowed_views.length > 0;
              return (
                <div key={p.user_id}>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_170px] max-md:grid-cols-1 gap-[10px] items-center border border-crm-line rounded-[7px] p-[9px_10px] text-[12px]">
                    <div>
                      <strong className="text-[13px] block">{p.display_name || p.email || "Teammate"}</strong>
                      <span className="text-crm-muted">{p.email}</span>
                      {(p.job_title || p.department) && <span className="text-crm-muted"> &middot; {[p.job_title, p.department].filter(Boolean).join(" &middot; ")}</span>}
                    </div>
                    <select value={p.role} onChange={(e) => updateRole(p.user_id, e.target.value)} disabled={isSelf} className="h-[32px]">
                      {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                    </select>
                    <span>{label(p.status || "active")}</span>
                    <div className="flex gap-[6px] flex-wrap justify-end">
                      {!isSelf && (
                        <button onClick={() => { setMessageThreadWith(p.user_id); setMessageThreadEmail(p.email || ""); }}
                          className="text-[12px] min-h-auto py-1 px-2">Message</button>
                      )}
                      <button onClick={() => setViewsOpenId(viewsOpen ? null : p.user_id)}
                        className="text-[12px] min-h-auto py-1 px-2">{restricted ? "Views*" : "Views"}</button>
                      <button onClick={() => updateStatus(p.user_id, p.status || "active")} disabled={isSelf}
                        className="text-[12px] min-h-auto py-1 px-2">
                        {p.status === "suspended" ? "Reinstate" : "Suspend"}
                      </button>
                    </div>
                  </div>
                  {viewsOpen && (
                    <div className="border border-crm-line rounded-[7px] p-3 mt-[-2px] bg-crm-panel-strong grid gap-[10px]">
                      <div>
                        <strong className="text-[13px] block">Visible pages for {p.display_name || p.email || "this teammate"}</strong>
                        <span className="text-crm-muted text-[12px]">
                          {isSelf ? "You can't restrict your own access." : restricted ? "Restricted to the checked pages below." : "Unrestricted — sees every page their role allows."}
                        </span>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                        {NAV_VIEWS.map((entry) => (
                          <label key={entry.id} className="flex items-center gap-[6px] text-[12px] font-medium text-crm-text">
                            <input
                              type="checkbox"
                              checked={!restricted || (p.allowed_views || []).includes(entry.id)}
                              disabled={isSelf}
                              onChange={() => {
                                const current = new Set(p.allowed_views || NAV_VIEWS.map((v) => v.id));
                                if (current.has(entry.id)) current.delete(entry.id); else current.add(entry.id);
                                updateViews(p.user_id, Array.from(current));
                              }}
                              className="w-[15px] h-[15px]"
                            />
                            {entry.label}
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => updateViews(p.user_id, [])} disabled={isSelf}
                          className="text-[12px] min-h-auto py-1 px-2">Reset to unrestricted</button>
                      </div>
                    </div>
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
