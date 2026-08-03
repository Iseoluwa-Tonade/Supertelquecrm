import { NAV_VIEWS } from "@/lib/types";
import type { Profile, Organisation } from "@/lib/types";

const FEATURE_IDS = new Set(NAV_VIEWS.map((v) => v.id));

export function canSeeView(
  profile: Profile | null | undefined,
  organisation: Organisation | null | undefined,
  viewId: string
): boolean {
  if (!profile) return false;

  if (!profile.registration_complete) {
    return viewId === "profile" || viewId === "organisations";
  }

  if (viewId === "profile") return true;

  if (FEATURE_IDS.has(viewId as (typeof NAV_VIEWS)[number]["id"])) {
    // tasks (Task scheduling) is always available as a feature; admins
    // fine-tune who sees it per member via allowed_views below.
    if (viewId !== "tasks") {
      const enabled = organisation?.enabled_features;
      if (enabled && enabled.length > 0 && !enabled.includes(viewId)) return false;
    }
  }

  if (["team", "pricing", "accounting"].includes(viewId) && profile.role !== "admin") return false;
  if (viewId === "sales" && profile.role === "viewer") return false;
  if (viewId === "invoicing" && (profile.role === "viewer" || profile.role === "owner")) return false;

  if (FEATURE_IDS.has(viewId as (typeof NAV_VIEWS)[number]["id"])) {
    const allowed = profile.allowed_views;
    if (allowed && allowed.length > 0 && !allowed.includes(viewId)) {
      const privileged = profile.role === "admin" || profile.role === "manager";
      if (!(privileged && viewId === "tasks")) return false;
    }
  }

  return true;
}
