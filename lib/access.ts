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
    const enabled = organisation?.enabled_features;
    if (enabled && enabled.length > 0 && !enabled.includes(viewId)) return false;
  }

  if (["team", "pricing", "accounting"].includes(viewId) && profile.role !== "admin") return false;
  if (viewId === "sales" && profile.role === "viewer") return false;
  if (viewId === "invoicing" && (profile.role === "viewer" || profile.role === "owner")) return false;

  if (FEATURE_IDS.has(viewId as (typeof NAV_VIEWS)[number]["id"])) {
    const allowed = profile.allowed_views;
    if (allowed && allowed.length > 0 && !allowed.includes(viewId)) return false;
  }

  return true;
}
