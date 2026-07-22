"use client";

import { AppProvider, useApp } from "@/lib/AppContext";
import { ToastProvider } from "@/components/Toast";
import Sidebar from "@/components/Sidebar";
import DetailPanel from "@/components/DetailPanel";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_VIEWS, FOCUS_COLUMNS } from "@/lib/types";
import type { Column } from "@/lib/types";
import { label, money, daysUntil, statusTitle, statusColor, cn } from "@/lib/utils";
import { PIPELINE_COLUMNS, PROJECT_COLUMNS } from "@/lib/types";

const supabase = createClient();

const pageMeta: Record<string, [string, string]> = {
  overview: ["CRM Overview", "See the journey, open value, project health, and today's daily work."],
  pipeline: ["Client Journey", "Move every account from responded email to project done."],
  projects: ["Project Delivery", "Move client work from backlog through shipped outcomes."],
  activity: ["Daily Activities", "Track calls, emails, proposals, delivery work, and admin follow-ups."],
  documents: ["Documents", "Upload, organize, and preview files linked to accounts and projects."],
  messages: ["Messages", "Direct messages between you and your manager or teammates."],
  approvals: ["Approval Queue", "Review team changes before they become approved CRM records."],
  focus: ["Focus Queue", "High-priority and near-due work across the whole book."],
  team: ["Team", "Manage teammate roles and access."],
  pricing: ["Pricing Calculator", "Manage the service catalog and quote a client."],
  profile: ["My Profile", "Your account, contact, and HR details."],
  organisations: ["Organisations", "Browse companies and request to join."],
};

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { session, loading, theme, setTheme, profile, items, changeRequests, messages, signOut, selectedId, setSelectedId } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const currentView = pathname.split("/").filter(Boolean)[0] || "overview";

  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || !profile) return;
    if (!profile.registration_complete) {
      if (currentView !== "profile" && currentView !== "organisations") {
        router.push("/profile");
      }
      return;
    }
    if (profile.role !== "admin") {
      supabase
        .from("invite_requests")
        .select("status")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setInviteStatus(data.status);
        });
    }
  }, [session, profile, loading]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setDropdownOpen(false);
        setMobileMenuOpen(false);
        setSelectedId(null);
      }
      if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-crm-bg text-crm-muted">
        Loading the CRM database...
      </div>
    );
  }

  if (!session) return null;

  if (inviteStatus === "pending" && currentView !== "profile") {
    router.push("/profile");
    return null;
  }

  const meta = pageMeta[currentView] || pageMeta.overview;
  const role = profile?.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager" || role === "admin";
  const isViewer = role === "viewer";

  const pendingApprovalsCount = changeRequests.filter((r) => r.status === "pending").length;
  const unreadMessages = messages.filter(
    (msg) => msg.recipient_id === session.user.id && !msg.read_at
  ).length;

  const showSearch = !["profile", "activity", "messages", "pricing"].includes(currentView);
  const showToolbar = ["pipeline", "projects", "focus"].includes(currentView);

  function columns(): Column[] {
    if (currentView === "projects") return PROJECT_COLUMNS;
    return PIPELINE_COLUMNS;
  }

  const showDetailToggle = ["pipeline", "projects", "focus", "overview"].includes(currentView);

  return (
    <>
    <div className="h-dvh grid max-lg:grid-cols-[74px_minmax(0,1fr)] max-md:!grid-cols-1 max-md:h-dvh overflow-hidden"
      style={{ gridTemplateColumns: "240px minmax(0,1fr)" }}
    >
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="grid grid-rows-[auto_auto_minmax(0,1fr)] min-w-0 min-h-0 overflow-hidden border-r border-crm-line max-md:flex max-md:flex-col max-md:border-r-0 max-md:min-h-0">
        <header className="bg-crm-panel border-b border-crm-line p-[14px_18px] flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <div className="title flex items-center gap-3 max-md:flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden max-md:grid w-[34px] h-[34px] place-items-center p-0 shrink-0"
              title="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div className="max-md:flex-1">
              <h1 className="m-0 text-[20px] leading-[1.2]">{meta[0]}</h1>
            </div>
            <div className="relative md:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-[34px] h-[34px] grid place-items-center p-0"
                title="More actions"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {mobileMenuOpen && (
                <div
                  className="absolute right-0 top-[42px] w-[220px] bg-crm-panel border border-crm-line rounded-[var(--radius,8px)]
                    shadow-[0_12px_30px_rgba(15,23,42,.08)] p-2 grid gap-1 z-20 origin-top-right"
                >
                  {showDetailToggle && (
                    <button
                      onClick={() => { setSelectedId(selectedId ? null : "new"); setMobileMenuOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-[6px] hover:bg-crm-panel-strong text-[13px] w-full text-left"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                        {selectedId
                          ? <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>
                          : <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></>
                        }
                      </svg>
                      {selectedId ? "Close details" : "Open details"}
                    </button>
                  )}
                  <button
                    onClick={() => { setTheme(theme === "dark" ? "light" : "dark"); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-[6px] hover:bg-crm-panel-strong text-[13px] w-full text-left"
                  >
                    <span className="w-4 h-4 grid place-items-center shrink-0 text-[14px]">{theme === "dark" ? "☀️" : "🌙"}</span>
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                  <div className="border-t border-crm-line my-1" />
                  <div className="px-3 py-2">
                    <div className="text-[13px] font-medium truncate">{session.user.email}</div>
                    <div className="text-crm-muted text-[11px] mt-0.5">
                      <span className="inline-flex items-center h-[18px] rounded-[9px] px-2 text-[10px] font-bold uppercase tracking-[.02em] bg-[rgba(15,118,110,.12)] text-crm-accent-strong">
                        {label(role || "owner")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { signOut(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-[6px] hover:bg-crm-panel-strong text-[13px] w-full text-left text-red-500"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0 max-md:w-full max-md:flex-wrap">
            {showSearch && (
            <div className="relative min-w-[260px] max-md:min-w-0 max-md:flex-1 max-md:min-w-[190px]">
              <svg
                className="absolute left-[10px] top-[9px] text-crm-muted pointer-events-none"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                data-search-input
                type="search"
                placeholder="Search account, owner, task"
                className="h-[36px] pl-[34px] bg-crm-panel-strong rounded-[6px]"
              />
            </div>
            )}
            <button
              className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3 hover:brightness-105 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,118,110,.28)] active:translate-y-0 disabled:bg-crm-panel-strong disabled:text-crm-muted disabled:border-crm-line disabled:cursor-not-allowed disabled:brightness-100 disabled:translate-y-0 disabled:shadow-none"
              hidden={!["pipeline", "projects", "focus"].includes(currentView)}
              disabled={isViewer}
            >
              + New
            </button>
            <div className="flex items-center gap-2 max-md:hidden">
              {showDetailToggle && (
                <button
                  onClick={() => setSelectedId(selectedId ? null : "new")}
                  className="w-[34px] h-[34px] grid place-items-center p-0"
                  title={selectedId ? "Close details" : "Open details"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {selectedId
                      ? <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>
                      : <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></>
                    }
                  </svg>
                </button>
              )}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-[34px] h-[34px] grid place-items-center p-0"
                title="Toggle dark mode"
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-[34px] h-[34px] rounded-full border border-crm-line bg-crm-accent text-white font-bold text-[13px] grid place-items-center p-0"
                  title="Account menu"
                >
                  {(session.user.email || "?")[0].toUpperCase()}
                </button>
                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-[42px] w-[240px] bg-crm-panel border border-crm-line rounded-[var(--radius,8px)]
                      shadow-[0_12px_30px_rgba(15,23,42,.08)] p-3 grid gap-[10px] z-20 origin-top-right"
                  >
                    <strong className="text-[13px] break-all">{session.user.email}</strong>
                    <div className="text-crm-muted text-[12px]">
                      <span className="inline-flex items-center h-[20px] rounded-[10px] px-2 text-[11px] font-bold uppercase tracking-[.02em] bg-[rgba(15,118,110,.12)] text-crm-accent-strong">
                        {label(role || "owner")}
                      </span>
                    </div>
                    <button
                      onClick={() => { signOut(); setDropdownOpen(false); }}
                      className="w-full"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="relative hidden md:block"></div>
          </div>
        </header>

        {showToolbar && (
          <section className="bg-crm-panel border-b border-crm-line p-[10px_18px] flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
            <div
              className="inline-grid grid-flow-col border border-crm-line rounded-[7px] overflow-hidden bg-crm-panel-strong"
              role="tablist"
            >
              {["all", "deal", "project", "task"].map((type) => (
                <button
                  key={type}
                  className="border-0 rounded-none min-h-[32px] px-3 bg-transparent text-crm-muted data-[active=true]:bg-crm-panel data-[active=true]:text-crm-text data-[active=true]:shadow-[inset_0_-2px_0_var(--color-crm-accent)]"
                >
                  {type === "all" ? "All" : `${type.charAt(0).toUpperCase()}${type.slice(1)}s`}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="overflow-y-auto min-h-0 max-md:flex-1 max-md:min-h-0">
          {children}
        </div>
      </main>
    </div>
    {selectedId && <DetailPanel />}
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ToastProvider>
        <DashboardInner>{children}</DashboardInner>
      </ToastProvider>
    </AppProvider>
  );
}
