"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback, useState, useEffect } from "react";
import { label, cn } from "@/lib/utils";
import { ROLES, NAV_VIEWS } from "@/lib/types";
import type { InviteRequest, Profile } from "@/lib/types";
import { PageHeader, Panel, PanelHead, Stat, Btn, Input, Avatar, Tag, DropdownSelect } from "@/components/kit.launchpad";
import { Drawer } from "@/components/Drawer";
import {
  Mail,
  Phone,
  Building2,
  Briefcase,
  ShieldCheck,
  Calendar,
  MapPin,
  User,
  BadgeCheck,
  Copy,
  Check,
  LayoutDashboard,
  KanbanSquare,
  FolderKanban,
  Activity,
  Files,
  MessageSquare,
  CheckSquare,
  Users,
  Calculator,
  Lock,
  Unlock,
  Sparkles,
  RefreshCw,
  CalendarClock,
} from "lucide-react";

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
        desc="Invite team members, approve access and keep page permissions aligned."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active members" value={String(memberCount)} delta="Current team size" spark={[3, 4, 5, 5, 6, 7]} />
        <Stat label="Pending invites" value={String(requestCount)} delta="Awaiting review" spark={[1, 2, 2, 3, 3, 4]} positive={false} />
        <Stat label="Visible page grants" value={String(visiblePages)} delta="Across the team" spark={[2, 3, 4, 4, 5, 6]} />
      </div>

      <Drawer open={!!viewingProfile} onClose={() => setViewingProfile(null)} title="Member Profile">
        {viewingProfile && <ProfileViewCard profile={viewingProfile} flash={flash} />}
      </Drawer>

      {inviteRequests.length > 0 && (
        <Panel>
          <PanelHead title={`Pending requests (${inviteRequests.length})`} hint="Approve or decline new team members" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
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
          title={`Team members (${teamProfiles.length})`}
          action={<Btn size="sm" onClick={() => setInviteFormOpen(true)}>Invite user</Btn>}
        />

        <Drawer open={inviteFormOpen} onClose={() => setInviteFormOpen(false)} title="Invite a team member">
          <form onSubmit={inviteUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-crm-sidebar-muted font-medium">Email address</label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammember@example.com" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-crm-sidebar-muted font-medium">Role</label>
              <DropdownSelect
                value={inviteRole}
                onChange={setInviteRole}
                ariaLabel="Role"
                placeholder="Choose role"
                options={ROLES.map((r) => ({ value: r, label: label(r) }))}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Btn type="submit" variant="primary" disabled={inviting}>{inviting ? "Sending..." : "Send invite"}</Btn>
            </div>
          </form>
        </Drawer>

        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
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
                          <p className="font-medium text-foreground">{p.display_name || p.email || "Team member"}{isSelf ? " (you)" : ""}</p>
                          <p className="text-xs text-muted-foreground">{p.email}{p.job_title ? ` · ${p.job_title}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownSelect
                        value={p.role}
                        onChange={(value) => updateRole(p.user_id, value)}
                        ariaLabel={`Role for ${p.display_name || p.email || "team member"}`}
                        placeholder="Choose role"
                        options={ROLES.map((r) => ({ value: r, label: label(r) }))}
                        className="h-8 text-xs"
                      />
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
          return `Access Permissions`;
        })()}
      >
        {(() => {
          const m = teamProfiles.find((p) => p.user_id === viewsOpenId);
          if (!m) return null;
          return <AccessControlCard member={m} isSelf={m.user_id === myId} updateViews={updateViews} />;
        })()}
      </Drawer>
    </div>
  );
}

function ProfileViewCard({ profile, flash }: { profile: Profile; flash: (msg: string) => void }) {
  const [copied, setCopied] = useState(false);

  const initials = (profile.display_name || profile.email || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleCopyEmail = () => {
    if (profile.email) {
      navigator.clipboard.writeText(profile.email);
      setCopied(true);
      flash("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const roleTone = profile.role === "admin" ? "primary" : profile.role === "manager" ? "accent" : "neutral";
  const statusTone = profile.status === "suspended" ? "warning" : "success";

  return (
    <div className="space-y-4 text-sm">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-white dark:bg-surface p-5 shadow-sm">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-linear-to-r from-primary via-accent to-primary/40" />

        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 font-mono text-xl font-bold text-primary ring-1 ring-primary/30 shadow-inner">
              {initials}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background p-0.5">
              <span className={`h-3 w-3 rounded-full ${profile.status === "suspended" ? "bg-warning" : "bg-success"}`} />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-foreground">{profile.display_name || "Unnamed Member"}</h3>
            <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{profile.email}</span>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Tag tone={roleTone} className="capitalize text-[11px] font-semibold">
                <ShieldCheck className="h-3 w-3 mr-1" />
                {label(profile.role || "viewer")}
              </Tag>
              <Tag tone={statusTone} className="capitalize text-[11px]">
                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${profile.status === "suspended" ? "bg-warning" : "bg-success"}`} />
                {label(profile.status || "active")}
              </Tag>
              {profile.job_title && (
                <Tag tone="neutral" className="text-[11px]">
                  {profile.job_title}
                </Tag>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center gap-2">
          {profile.email && (
            <a
              href={`mailto:${profile.email}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised transition-colors shadow-sm"
            >
              <Mail className="h-3.5 w-3.5 text-primary" />
              Email
            </a>
          )}
          {profile.phone && (
            <a
              href={`tel:${profile.phone}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised transition-colors shadow-sm"
            >
              <Phone className="h-3.5 w-3.5 text-accent" />
              Call
            </a>
          )}
          <button
            onClick={handleCopyEmail}
            title="Copy Email"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Employment Details */}
      <div className="rounded-2xl border border-border bg-white dark:bg-surface p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          Employment Information
        </h4>
        <div className="grid grid-cols-2 gap-2.5">
          <ProfileField label="Department" value={profile.department} icon={Building2} />
          <ProfileField label="Job Title" value={profile.job_title} icon={Briefcase} />
          <ProfileField label="Employee ID" value={profile.employee_id} icon={BadgeCheck} />
          <ProfileField label="Start Date" value={profile.start_date} icon={Calendar} />
        </div>
      </div>

      {/* Contact Details */}
      <div className="rounded-2xl border border-border bg-white dark:bg-surface p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-accent" />
          Contact Information
        </h4>
        <div className="space-y-2.5">
          <ProfileField label="Email" value={profile.email} icon={Mail} fullWidth />
          <ProfileField label="Phone Number" value={profile.phone} icon={Phone} fullWidth />
          <ProfileField label="Address" value={profile.address} icon={MapPin} fullWidth />
        </div>
      </div>

      {/* Emergency Contact Info */}
      {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
        <div className="rounded-2xl border border-border bg-white dark:bg-surface p-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-warning" />
            Emergency Contact
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            <ProfileField label="Contact Name" value={profile.emergency_contact_name} icon={User} />
            <ProfileField label="Emergency Phone" value={profile.emergency_contact_phone} icon={Phone} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileField({
  label,
  value,
  icon: Icon,
  fullWidth = false,
}: {
  label: string;
  value?: string | null;
  icon?: React.ElementType;
  fullWidth?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-white/8 bg-surface-raised dark:bg-white/10 p-2.5 ${fullWidth ? "col-span-2" : ""}`}>
      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground/70" />}
        {label}
      </p>
      <p className="text-xs font-medium text-foreground break-all">{value || "—"}</p>
    </div>
  );
}

const viewIconMap: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  pipeline: KanbanSquare,
  projects: FolderKanban,
  activity: Activity,
  documents: Files,
  messages: MessageSquare,
  approvals: ShieldCheck,
  tasks: CalendarClock,
  focus: CheckSquare,
  team: Users,
  pricing: Calculator,
  profile: User,
};

function AccessControlCard({
  member,
  isSelf,
  updateViews,
}: {
  member: Profile;
  isSelf: boolean;
  updateViews: (userId: string, views: string[]) => Promise<void>;
}) {
  const restricted = Array.isArray(member.allowed_views) && member.allowed_views.length > 0;
  const currentAllowed = new Set(member.allowed_views || NAV_VIEWS.map((v) => v.id));
  const activeCount = restricted ? (member.allowed_views || []).length : NAV_VIEWS.length;

  const handleToggle = (viewId: string) => {
    if (isSelf) return;
    const next = new Set(currentAllowed);
    if (next.has(viewId)) {
      next.delete(viewId);
    } else {
      next.add(viewId);
    }
    updateViews(member.user_id, Array.from(next));
  };

  const handleGrantAll = () => {
    if (isSelf) return;
    updateViews(member.user_id, NAV_VIEWS.map((v) => v.id));
  };

  const handleResetUnrestricted = () => {
    if (isSelf) return;
    updateViews(member.user_id, []);
  };

  const initials = (member.display_name || member.email || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-4 text-sm">
      {/* Member Header Card */}
      <div className="rounded-2xl border border-border bg-white dark:bg-surface p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} size="md" tone="primary" />
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-bold text-foreground">{member.display_name || member.email}</h4>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
          <Tag tone={restricted ? "warning" : "success"} className="capitalize text-[11px] shrink-0 font-medium">
            {restricted ? (
              <>
                Custom Access
              </>
            ) : (
              <>
                Unrestricted
              </>
            )}
          </Tag>
        </div>

        {/* Access Status Banner */}
        <div
          className={cn(
            "rounded-xl border p-3 text-xs leading-relaxed transition-colors",
            isSelf
              ? "border-info/30 bg-info/10 text-info"
              : restricted
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-success/30 bg-success/10 text-success"
          )}
        >
          {isSelf ? (
            <p className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              You have full permission and access.
            </p>
          ) : restricted ? (
            <p className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 shrink-0 text-warning" />
              <span><strong>Restricted Mode:</strong> Team member can only access the {activeCount} checked page(s) below.</span>
            </p>
          ) : (
            <p className="flex items-center gap-1.5">
              <Unlock className="h-4 w-4 shrink-0 text-success" />
              <span><strong>Unrestricted Mode:</strong> Team member has access to all {NAV_VIEWS.length} pages allowed by their role.</span>
            </p>
          )}
        </div>
      </div>

      {/* Global Actions Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3 px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Page Grants ({activeCount} of {NAV_VIEWS.length})
        </span>

        {!isSelf && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGrantAll}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-2.5 text-xs font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/25 cursor-pointer select-none"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Select All
            </button>
            <button
              type="button"
              onClick={handleResetUnrestricted}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs font-medium text-crm-sidebar-text transition-colors hover:bg-white/10 hover:text-white cursor-pointer select-none"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Page Permissions Toggles List */}
      <div className="space-y-2">
        {NAV_VIEWS.map((entry) => {
          const Icon = viewIconMap[entry.id] || LayoutDashboard;
          const isAllowed = !restricted || currentAllowed.has(entry.id);

          return (
            <div
              key={entry.id}
              onClick={() => !isSelf && handleToggle(entry.id)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-200",
                !isSelf && "cursor-pointer hover:border-primary/40",
                isAllowed
                  ? "border-border bg-surface/90 shadow-xs"
                  : "border-white/10 bg-white/6"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                    isAllowed ? "bg-primary/15 text-primary" : "bg-white/10 text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={cn("truncate text-xs font-semibold", isAllowed ? "text-foreground" : "text-white")}>{entry.label}</p>
                  <span className={cn("font-mono text-[10px]", isAllowed ? "text-muted-foreground" : "text-white/60")}>/{entry.id}</span>
                </div>
              </div>

              <ToggleSwitch
                checked={isAllowed}
                onChange={() => handleToggle(entry.id)}
                disabled={isSelf}
                ariaLabel={`Toggle access to ${entry.label}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <span
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }
      }}
      className={cn(
        "relative inline-flex items-center shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        checked ? "bg-primary" : "bg-white/20",
        disabled && "opacity-40 cursor-not-allowed"
      )}
      style={{ width: 40, height: 22, minHeight: 0, border: "none", background: undefined }}
    >
      {/* Track */}
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-white/20"
        )}
      />
      {/* Thumb */}
      <span
        className={cn(
          "relative inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
        style={{ width: 18, height: 18, marginTop: 2, marginBottom: 2 }}
      />
    </span>
  );
}

