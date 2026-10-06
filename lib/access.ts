import type { Organisation, Profile } from "@/lib/types";

export type CrmRole = "admin" | "manager" | "owner" | "viewer";

export const ROLE_LABELS: Record<CrmRole, string> = {
  admin: "Admin",
  manager: "Manager",
  owner: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<CrmRole, string> = {
  admin: "Full workspace control, team access, finance, settings and all CRM records.",
  manager: "Operational control of revenue, delivery, approvals, reporting and team workflows.",
  owner: "Contributor access to assigned work, activities, documents and collaboration.",
  viewer: "Read-only access to specifically permitted workspace areas.",
};

export const ALL_CRM_VIEWS = [
  "overview",
  "activity",
  "notifications",
  "messages",
  "emails",
  "connections",
  "pipeline",
  "clients",
  "contacts",
  "sales",
  "pricing",
  "projects",
  "tasks",
  "my-tasks",
  "focus",
  "documents",
  "inventory",
  "invoicing",
  "accounting",
  "approvals",
  "reports",
  "team",
  "profile",
  "settings",
] as const;

export type CrmView = (typeof ALL_CRM_VIEWS)[number];

const ADMIN_VIEWS = new Set<CrmView>(ALL_CRM_VIEWS);

const MANAGER_VIEWS = new Set<CrmView>([
  "overview",
  "activity",
  "notifications",
  "messages",
  "emails",
  "connections",
  "pipeline",
  "clients",
  "contacts",
  "sales",
  "projects",
  "tasks",
  "my-tasks",
  "focus",
  "documents",
  "inventory",
  "invoicing",
  "approvals",
  "reports",
  "profile",
  "settings",
]);

const MEMBER_VIEWS = new Set<CrmView>([
  "overview",
  "activity",
  "notifications",
  "messages",
  "clients",
  "contacts",
  "projects",
  "tasks",
  "my-tasks",
  "focus",
  "documents",
  "inventory",
  "reports",
  "profile",
]);

const VIEWER_VIEWS = new Set<CrmView>([
  "overview",
  "notifications",
  "messages",
  "documents",
  "profile",
]);

const ROLE_VIEWS: Record<CrmRole, Set<CrmView>> = {
  admin: ADMIN_VIEWS,
  manager: MANAGER_VIEWS,
  owner: MEMBER_VIEWS,
  viewer: VIEWER_VIEWS,
};

export function viewsForRole(role: Profile["role"] | null | undefined): CrmView[] {
  const resolved = (role || "viewer") as CrmRole;
  return Array.from(ROLE_VIEWS[resolved] || VIEWER_VIEWS);
}

export function canSeeView(
  profile: Profile | null | undefined,
  organisation: Organisation | null | undefined,
  viewId: string,
): boolean {
  if (!profile || profile.status !== "active") return false;

  if (!profile.registration_complete) {
    return viewId === "profile" || viewId === "organisations";
  }

  if (viewId === "profile") return true;
  if (viewId === "organisations") return profile.role === "admin";

  const role = (profile.role || "viewer") as CrmRole;
  const roleViews = ROLE_VIEWS[role] || VIEWER_VIEWS;

  if (!roleViews.has(viewId as CrmView)) return false;

  const enabled = organisation?.enabled_features;
  if (
    enabled &&
    enabled.length > 0 &&
    ALL_CRM_VIEWS.includes(viewId as CrmView) &&
    !enabled.includes(viewId)
  ) {
    return false;
  }

  const allowed = profile.allowed_views;
  if (
    allowed &&
    allowed.length > 0 &&
    ALL_CRM_VIEWS.includes(viewId as CrmView) &&
    !allowed.includes(viewId)
  ) {
    return false;
  }

  return true;
}

export function canManageTeam(profile: Profile | null | undefined): boolean {
  return profile?.status === "active" && profile.role === "admin";
}

export function canManageWorkspace(profile: Profile | null | undefined): boolean {
  return profile?.status === "active" && profile.role === "admin";
}

export function canManageOperations(profile: Profile | null | undefined): boolean {
  return (
    profile?.status === "active" &&
    (profile.role === "admin" || profile.role === "manager")
  );
}

export function canContribute(profile: Profile | null | undefined): boolean {
  return (
    profile?.status === "active" &&
    (profile.role === "admin" || profile.role === "manager" || profile.role === "owner")
  );
}
