"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState, useEffect } from "react";
import { label } from "@/lib/utils";
import { ROLES, NAV_VIEWS } from "@/lib/types";
import type { InviteRequest, Profile } from "@/lib/types";
import { PageHeader, Panel, PanelHead, Stat, Btn, Input, Avatar } from "@/components/kit.launchpad";
import { Drawer } from "@/components/Drawer";

const supabase = createClient();

export default function TeamPage() {
  const { session, profile, teamProfiles, inviteRequests, setInviteFormOpen, inviteFormOpen,
    loadTeamProfiles, loadInviteRequests, loadRemoteItems } = useApp();
  const { flash } = useToast();
  const [viewsOpenId, setViewsOpenId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("owner");
  const [inviting, setInviting] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);

  const isAdmin = profile?.role === "admin";

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

  const viewProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (data) setViewingProfile(data as Profile);
  }, []);

  const updateRole = useCallback(async (userId: string, role: string) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("user_id", userId);
    if (error) { flash(error.message); return; }
    await loadTeamProfiles();
    flash("Role updated");
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

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader variant="operations" eyebrow="Operations" title="Team & invites" />
        <Panel className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Only admins can manage the team.</p>
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

      <Drawer open={!!viewingProfile} onClose={() => setViewingProfile(null)} title="Profile details">
        {viewingProfile && (
          <div className="space-y-1 text-sm">
            {[
              ["ID", viewingProfile.user_id],
              ["Name", viewingProfile.display_name],
              ["Email", viewingProfile.email],
              ["Role", label(viewingProfile.role || "viewer")],
              ["Status", label(viewingProfile.status || "active")],
              ["Job title", viewingProfile.job_title],
              ["Phone", viewingProfile.phone],
              ["Department", viewingProfile.department],
              ["Employee ID", viewingProfile.employee_id],
              ["Start date", viewingProfile.start_date],
              ["Address", viewingProfile.address],
              ["Emergency contact", viewingProfile.emergency_contact_name],
              ["Emergency phone", viewingProfile.emergency_contact_phone],
            ].map(([k, v]) => (
              <div key={k as string} className="grid grid-cols-[120px_1fr] gap-2 rounded-lg border border-white/10 bg-white/5 p-2 items-center">
                <span className="text-crm-sidebar-muted">{k as string}</span>
                <span className="break-all">{v || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {inviteRequests.length > 0 && (
        <Panel>
          <PanelHead title={`Pending requests (${inviteRequests.length})`} hint="Approve or decline new teammates" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Member</th>
                  <th className="px-4 py-2.5 text-left font-medium">Job title</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inviteRequests.map((req) => {
                  const r = req as InviteRequest & { requester?: Partial<Profile> };
                  return (
                    <tr key={req.id} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={(r.requester?.display_name || r.requester?.email || "?").slice(0, 2).toUpperCase()} size="sm" />
                          <div>
                            <p className="font-medium text-foreground">{r.requester?.display_name || "New member"}</p>
                            <p className="text-xs text-muted-foreground">{r.requester?.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.requester?.job_title || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end whitespace-nowrap">
                          <Btn size="sm" onClick={() => viewProfile(req.user_id)}>View profile</Btn>
                          <Btn size="sm" variant="danger" onClick={() => rejectRequest(req)}>Reject</Btn>
                          <Btn size="sm" variant="primary" onClick={() => approveRequest(req)}>Invite</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamProfiles.map((p) => {
                const isSelf = p.user_id === myId;
                const restricted = Array.isArray(p.allowed_views) && p.allowed_views.length > 0;
                return (
                  <tr key={p.user_id} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={(p.display_name || p.email || "?").slice(0, 2).toUpperCase()} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{p.display_name || p.email || "Teammate"}{isSelf ? " (you)" : ""}</p>
                          <p className="text-xs text-muted-foreground">{p.email}{p.job_title ? ` · ${p.job_title}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select value={p.role} onChange={(e) => updateRole(p.user_id, e.target.value)} disabled={isSelf} className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-primary/60">
                        {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{label(p.status || "active")}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end whitespace-nowrap">
                        <Btn size="sm" onClick={() => viewProfile(p.user_id)}>View profile</Btn>
                        <Btn size="sm" onClick={() => setViewsOpenId(p.user_id)}>
                          {restricted ? "Access*" : "Access"}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Drawer
        open={!!viewsOpenId}
        onClose={() => setViewsOpenId(null)}
        title={(() => {
          const m = teamProfiles.find((p) => p.user_id === viewsOpenId);
          return `Access for ${m?.display_name || m?.email || "this teammate"}`;
        })()}
      >
        {(() => {
          const m = teamProfiles.find((p) => p.user_id === viewsOpenId);
          if (!m) return null;
          const isSelf = m.user_id === myId;
          const restricted = Array.isArray(m.allowed_views) && m.allowed_views.length > 0;
          return (
            <div className="space-y-3">
              <p className="text-xs text-crm-sidebar-muted">
                {isSelf ? "You can't restrict your own access." : restricted ? "Restricted to the checked pages below." : "Unrestricted — sees every page their role allows."}
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                {NAV_VIEWS.map((entry) => (
                  <label key={entry.id} className="flex items-center gap-1.5 text-xs text-crm-sidebar-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!restricted || (m.allowed_views || []).includes(entry.id)}
                      disabled={isSelf}
                      onChange={() => {
                        const current = new Set(m.allowed_views || NAV_VIEWS.map((v) => v.id));
                        if (current.has(entry.id)) current.delete(entry.id); else current.add(entry.id);
                        updateViews(m.user_id, Array.from(current));
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    {entry.label}
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Btn size="sm" onClick={() => updateViews(m.user_id, [])} disabled={isSelf}>Reset to unrestricted</Btn>
              </div>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
