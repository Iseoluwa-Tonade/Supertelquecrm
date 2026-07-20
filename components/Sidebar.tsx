"use client";

import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { NAV_VIEWS } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";

const SVG_ICONS: Record<string, React.ReactNode> = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <rect x="3" y="3" width="7" height="8" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="15" width="7" height="6" />
    </svg>
  ),
  pipeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <path d="M4 5h16M4 12h16M4 19h16" /><path d="M9 5v14M15 5v14" />
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  approvals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <path d="M9 12l2 2 4-4" /><path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  ),
  focus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  pricing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] shrink-0">
      <rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M6 17c.5-2 1.5-3 3-3s2.5 1 3 3" /><path d="M15 10h4M15 14h4" />
    </svg>
  ),
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, items, messages } = useApp();
  const currentView = pathname.split("/").filter(Boolean)[0] || "overview";
  const role = profile?.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager" || role === "admin";

  const pendingApprovals = messages.filter(
    (msg) => msg.recipient_id === profile?.user_id && !msg.read_at
  ).length;

  function canSeeView(viewId: string) {
    if (viewId === "pricing" && !isAdmin) return false;
    if (viewId === "pipeline" && !isAdmin) return false;
    if (viewId === "team" && !isManager) return false;
    const allowed = profile?.allowed_views;
    if (allowed && allowed.length > 0 && !allowed.includes(viewId)) return false;
    return true;
  }

  const openValue = items
    .filter((item) => !["project_done", "project_delivered", "project_closed"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);

  const dueThisWeek = items.filter((item) => {
    const days = Math.ceil((new Date(item.due).getTime() - new Date().getTime()) / 86400000);
    return days >= 0 && days <= 7;
  }).length;

  return (
      <aside
        className="bg-crm-sidebar text-crm-sidebar-text p-[18px_14px] flex flex-col gap-[18px] min-w-0 h-screen overflow-y-auto
        max-lg:p-[14px_10px] max-md:sticky max-md:top-0 max-md:z-4 max-md:flex-row max-md:items-center max-md:p-[10px] max-md:h-auto max-md:overflow-visible"
      >
      <Link
        href="/overview"
        className="flex items-center gap-[10px] p-[0_6px_10px] border-b border-[rgba(255,255,255,.12)] w-full bg-transparent
          border-l-0 border-r-0 border-t-0 text-left cursor-pointer min-h-auto no-underline text-inherit
          max-md:border-0 max-md:p-0 hover:[&_.mark]:bg-[rgba(255,255,255,.14)]"
      >
        <div className="w-[38px] h-[38px] rounded-[8px] bg-[rgba(255,255,255,.08)] border border-[rgba(255,255,255,.12)] grid place-items-center overflow-hidden shrink-0">
          <Image src="/supertelque-logo.png" alt="SuperTelque" width={34} height={34} className="object-contain" />
        </div>
        <div className="max-lg:hidden">
          <strong className="block text-[15px]">SuperTelque CRM</strong>
          <span className="block text-crm-sidebar-muted text-[12px] mt-[2px]">
            Client journey and delivery
          </span>
        </div>
      </Link>

      <nav className="grid gap-[4px] max-md:grid-flow-col max-md:overflow-x-auto max-md:flex-1">
        {NAV_VIEWS.filter((v) => canSeeView(v.id)).map((view) => {
          const isActive = currentView === view.id;
          return (
            <Link
              key={view.id}
              href={`/${view.id}`}
              className={`flex gap-[10px] items-center rounded-[6px] text-left p-[9px_10px] no-underline
                transition-[background,color,transform] duration-150
                max-lg:justify-center max-lg:p-[10px]
                ${isActive ? "bg-[rgba(255,255,255,.09)] text-white" : "text-crm-sidebar-text"}
                hover:bg-[rgba(255,255,255,.09)] hover:text-white active:scale-[.97]
              `}
            >
              {SVG_ICONS[view.id]}
              <span className="max-lg:hidden">{view.label}</span>
            </Link>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="mt-auto grid gap-[10px] max-lg:hidden">
          <div className="bg-[rgba(255,255,255,.08)] border border-[rgba(255,255,255,.1)] rounded-[var(--radius,8px)] p-[12px]">
            <span className="text-crm-sidebar-muted text-[12px]">Open value</span>
            <strong className="block mt-[6px] text-[20px]">
              ${openValue.toLocaleString()}
            </strong>
          </div>
          <div className="bg-[rgba(255,255,255,.08)] border border-[rgba(255,255,255,.1)] rounded-[var(--radius,8px)] p-[12px]">
            <span className="text-crm-sidebar-muted text-[12px]">Due this week</span>
            <strong className="block mt-[6px] text-[20px]">{dueThisWeek}</strong>
          </div>
        </div>
      )}
    </aside>
  );
}
