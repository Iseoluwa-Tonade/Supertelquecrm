"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState, useEffect } from "react";
import { label } from "@/lib/utils";
import { ROLES, NAV_VIEWS } from "@/lib/types";
import type { InviteRequest, Profile } from "@/lib/types";
import { Avatar, PageHeader, Panel, PanelHead, Stat, Tag, Btn, Input } from "@/components/kit.launchpad";

const supabase = createClient();

export default function TeamPage() {
  const { session, profile, teamProfiles, inviteRequests, setInviteFormOpen, inviteFormOpen,
    loadTeamProfiles, loadInviteRequests, setMessageThreadWith, setMessageThreadEmail, loadRemoteItems } = useApp();
  const { flash } = useToast();
  const [viewsOpenId, setViewsOpenId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("owner");
  const [inviting, setInviting] = useState(false);
  const [viewingRequester, setViewingRequester] = useState<Profile | null>(null);

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

  const approveRequest = useCallback(async (req: InviteRequest) => {
    const { error } = await supabase
      .from("invite_requests")
      .update({ status: "approved" })
      .eq("id", req.id);
    if (error) { flash(error.message); return; }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "viewer", registration_complete: true })
      .eq("user_id", req.user_id);
    if (profileError) { console.error(profileError.message); }
    await loadInviteRequests();
    await loadTeamProfiles();
    flash("Invite approved");
  }, [supabase, loadInviteRequests, loadTeamProfiles, flash]);

  const rejectRequest = useCallback(async (req: InviteRequest) => {
    const { error } = await supabase
      .from("invite_requests")
      .update({ status: "rejected" })
      .eq("id", req.id);
    if (error) { flash(error.message); return; }
    await loadInviteRequests();
    flash("Request rejected");
  }, [supabase, loadInviteRequests, flash]);

  const viewRequesterProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (data) setViewingRequester(data as Profile);
  }, []);

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
  const requestCount = inviteRequests.length;
  const memberCount = teamProfiles.length;
  const visiblePages = Array.from(new Set(teamProfiles.flatMap((member) => member.allowed_views || []))).length;

  if (!isManager) {
    return (
      <div className="space-y-6">
        <PageHeader variant="operations" eyebrow="Operations" title="Team & invites" />
        <Panel className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Only managers and admins can manage the team.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader variant="operations"
        eyebrow="Operations"
        title="Team & invites"
        desc="Invite teammates, approve access and keep page permissions aligned."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active members" value={String(memberCount)} delta="Current team size" spark={[3, 4, 5, 5, 6, 7]} />
        <Stat label="Pending invites" value={String(requestCount)} delta="Awaiting review" spark={[1, 2, 2, 3, 3, 4]} positive={false} />
        <Stat label="Visible page grants" value={String(visiblePages)} delta="Across the team" spark={[2, 3, 4, 4, 5, 6]} />
      </div>

      {viewingRequester && (
        <Panel>
          <PanelHead
            title="Requester profile"
            hint="Reviewed before an invite is approved"
            action={<Btn size="sm" onClick={() => setViewingRequester(null)}>Close</Btn>}
          />
          <div className="space-y-1 p-4 text-sm">
            {[
              ["Name", viewingRequester.display_name],
              ["Email", viewingRequester.email],
              ["Job title", viewingRequester.job_title],
              ["Phone", viewingRequester.phone],
              ["Department", viewingRequester.department],
              ["Address", viewingRequester.address],
            ].map(([k, v]) => (
              <div key={k as string} className="grid grid-cols-[120px_1fr] gap-2 rounded-lg border border-border bg-surface p-2">
                <span className="text-muted-foreground">{k as string}</span>
                <span>{v || "—"}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {inviteRequests.length > 0 && (
        <Panel>
          <PanelHead title={`Pending requests (${inviteRequests.length})`} hint="Approve or decline new teammates" />
          <div className="divide-y divide-border">
            {inviteRequests.map((req) => {
              const r = req as InviteRequest & { requester?: Partial<Profile> };
              return (
                <div key={req.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{r.requester?.display_name || "New member"}</p>
                    <p className="text-xs text-muted-foreground">{r.requester?.email || "—"}{r.requester?.job_title ? ` · ${r.requester.job_title}` : ""}</p>
                  </div>
                  <Btn size="sm" onClick={() => viewRequesterProfile(req.user_id)}>View profile</Btn>
                  <div className="flex gap-1">
                    <Btn size="sm" variant="danger" onClick={() => rejectRequest(req)}>Reject</Btn>
                    <Btn size="sm" variant="primary" onClick={() => approveRequest(req)}>Invite</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHead
          title={`Teammates (${teamProfiles.length})`}
          action={<Btn size="sm" onClick={() => setInviteFormOpen(!inviteFormOpen)}>{inviteFormOpen ? "Cancel" : "Invite user"}</Btn>}
        />

        {inviteFormOpen && (
          <form onSubmit={inviteUser} className="border-b border-border p-4 space-y-3 bg-surface">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com" required />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="h-10 rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60">
                {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
              </select>
            </div>
            <div className="flex justify-end">
              <Btn type="submit" variant="primary" disabled={inviting}>{inviting ? "Sending..." : "Send invite"}</Btn>
            </div>
          </form>
        )}

        <div className="divide-y divide-border">
          <div className="grid grid-cols-[1fr_120px_100px_170px] gap-2 px-4 py-2 text-xs font-bold text-muted-foreground max-md:hidden">
            <span>Email</span><span>Role</span><span>Status</span><span></span>
          </div>
          {teamProfiles.map((p) => {
            const isSelf = p.user_id === myId;
            const viewsOpen = viewsOpenId === p.user_id;
            const restricted = Array.isArray(p.allowed_views) && p.allowed_views.length > 0;
            return (
              <div key={p.user_id}>
                <div className="grid grid-cols-[1fr_120px_100px_170px] max-md:grid-cols-1 gap-2 items-center px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{p.display_name || p.email || "Teammate"}</p>
                    <p className="text-xs text-muted-foreground">{p.email}{p.job_title ? ` · ${p.job_title}` : ""}</p>
                  </div>
                  <select value={p.role} onChange={(e) => updateRole(p.user_id, e.target.value)} disabled={isSelf} className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60">
                    {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                  </select>
                  <span className="text-xs">{label(p.status || "active")}</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {!isSelf && (
                      <Btn size="sm" onClick={() => { setMessageThreadWith(p.user_id); setMessageThreadEmail(p.email || ""); }}>Message</Btn>
                    )}
                    <Btn size="sm" onClick={() => setViewsOpenId(viewsOpen ? null : p.user_id)}>
                      {restricted ? "Views*" : "Views"}
                    </Btn>
                    <Btn size="sm" onClick={() => updateStatus(p.user_id, p.status || "active")} disabled={isSelf}>
                      {p.status === "suspended" ? "Reinstate" : "Suspend"}
                    </Btn>
                  </div>
                </div>
                {viewsOpen && (
                  <div className="border-t border-border bg-surface px-4 py-3 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Visible pages for {p.display_name || p.email || "this teammate"}</p>
                      <p className="text-xs text-muted-foreground">
                        {isSelf ? "You can't restrict your own access." : restricted ? "Restricted to the checked pages below." : "Unrestricted — sees every page their role allows."}
                      </p>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                      {NAV_VIEWS.map((entry) => (
                        <label key={entry.id} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!restricted || (p.allowed_views || []).includes(entry.id)}
                            disabled={isSelf}
                            onChange={() => {
                              const current = new Set(p.allowed_views || NAV_VIEWS.map((v) => v.id));
                              if (current.has(entry.id)) current.delete(entry.id); else current.add(entry.id);
                              updateViews(p.user_id, Array.from(current));
                            }}
                            className="h-4 w-4"
                          />
                          {entry.label}
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Btn size="sm" onClick={() => updateViews(p.user_id, [])} disabled={isSelf}>Reset to unrestricted</Btn>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
