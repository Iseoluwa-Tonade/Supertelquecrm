"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  KanbanSquare,
  FolderKanban,
  Activity,
  Files,
  MessageSquare,
  ShieldCheck,
  Users,
  Calculator,
  Search,
  PanelLeftClose,
  PanelLeft,
  Command,
  Building2,
  Contact,
  TrendingUp,
  CalendarClock,
  CheckSquare,
  ReceiptText,
  Landmark,
  Boxes,
  FileBarChart,
  Bell,
  Settings,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useApp } from "@/lib/AppContext";
import { canSeeView } from "@/lib/access";
import { Avatar, Tag } from "./kit.launchpad";

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { to: "/overview", label: "Dashboard", icon: LayoutDashboard },
      { to: "/activity", label: "Activity log", icon: Activity },
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    group: "Revenue",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { to: "/clients", label: "Clients", icon: Building2 },
      { to: "/contacts", label: "Contacts", icon: Contact },
      { to: "/sales", label: "Sales", icon: TrendingUp },
      { to: "/pricing", label: "Pricing", icon: Calculator },
    ],
  },
  {
    group: "Delivery",
    items: [
      { to: "/projects", label: "Projects", icon: FolderKanban },
      { to: "/tasks", label: "Task scheduling", icon: CalendarClock },
      { to: "/my-tasks", label: "My tasks", icon: CheckSquare },
      { to: "/focus", label: "Focus board", icon: Activity },
      { to: "/documents", label: "Documents", icon: Files },
      { to: "/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    group: "Finance",
    items: [
      { to: "/invoicing", label: "Invoicing", icon: ReceiptText },
      { to: "/accounting", label: "Accounting", icon: Landmark },
    ],
  },
  {
    group: "Operations",
    items: [
      { to: "/approvals", label: "Approvals", icon: ShieldCheck },
      { to: "/reports", label: "Reports", icon: FileBarChart },
      { to: "/team", label: "Team & invites", icon: Users },
      { to: "/profile", label: "My profile", icon: Users },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppShellLaunchpad({ children }: { children: React.ReactNode }) {
  const { profile, organisation, session, theme, setTheme, signOut } = useApp();
  const pathname = usePathname() || "/";
  const [railOpen, setRailOpen] = React.useState(true);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const regComplete = profile?.registration_complete ?? true;
  const navItems: { group: string; items: NavItem[] }[] = regComplete
    ? NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => canSeeView(profile, organisation, item.to.slice(1))),
      })).filter((group) => group.items.length > 0)
    : [{ group: "Getting started", items: [{ to: "/profile", label: "My profile", icon: Users }] }];
  const CURRENT_ORG = organisation || { name: "Workspace", company_type: "workspace" };
  const CURRENT_USER = profile || { display_name: "You", job_title: "" };
  const initials =
    (CURRENT_USER.display_name || "U")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.12),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(37,99,235,0.08),transparent_22%)]" />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border bg-[linear-gradient(180deg,rgba(17,26,40,.96),rgba(17,26,40,.92))] text-crm-sidebar-text shadow-[12px_0_30px_-26px_rgba(15,23,42,.6)] transition-[width] duration-200 md:flex",
          railOpen ? "w-60" : "w-16",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_rgba(45,212,191,0.8)]">
            <Command className="h-4 w-4" />
          </span>
          {railOpen ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{CURRENT_ORG.name}</p>
              <p className="label-tag text-muted-foreground">{CURRENT_ORG.company_type || "workspace"}</p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navItems.map((section) => (
            <div key={section.group}>
              {railOpen ? (
                <p className="label-tag mb-2 px-2 text-crm-sidebar-muted/80">{section.group}</p>
              ) : (
                <div className="mx-2 mb-2 h-px bg-white/10" />
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.to || pathname === item.to + "/";
                  return (
                    <li key={item.to}>
                      <Link
                        href={item.to}
                        title={item.label}
                        className={cn(
                            "group relative flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition-colors",
                          active
                              ? "bg-white/10 text-white shadow-[0_8px_20px_-18px_rgba(255,255,255,0.6)]"
                              : "text-crm-sidebar-muted hover:bg-white/8 hover:text-white",
                        )}
                      >
                        {active ? (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                        ) : null}
                        <item.icon className="h-4 w-4 shrink-0" />
                        {railOpen ? <span className="truncate">{item.label}</span> : null}
                        {railOpen && item.badge ? (
                            <span className="num ml-auto rounded-full bg-white/10 px-1.5 text-[10px] text-white">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <button
          onClick={() => setRailOpen((open) => !open)}
          className="flex h-11 items-center gap-2.5 border-t border-white/10 px-4 text-xs text-crm-sidebar-muted hover:text-white"
        >
          {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          {railOpen ? "Collapse" : null}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-border bg-[linear-gradient(180deg,rgba(17,26,40,.96),rgba(17,26,40,.92))] text-crm-sidebar-text shadow-xl md:hidden"
            >
              <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_rgba(45,212,191,0.8)]">
                    <Command className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">{CURRENT_ORG.name}</p>
                    <p className="label-tag text-muted-foreground">{CURRENT_ORG.company_type || "workspace"} workspace</p>
                  </div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-crm-sidebar-muted hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                {navItems.map((section) => (
                  <div key={section.group}>
                    <p className="label-tag mb-2 px-2 text-crm-sidebar-muted/80">{section.group}</p>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = pathname === item.to || pathname === item.to + "/";
                        return (
                          <li key={item.to}>
                            <Link
                              href={item.to}
                              title={item.label}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "group relative flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition-colors",
                                active
                                  ? "bg-white/10 text-white shadow-[0_8px_20px_-18px_rgba(255,255,255,0.6)]"
                                  : "text-crm-sidebar-muted hover:bg-white/8 hover:text-white",
                              )}
                            >
                              {active ? (
                                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                              ) : null}
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                              {item.badge ? (
                                <span className="num ml-auto rounded-full bg-white/10 px-1.5 text-[10px] text-white">
                                  {item.badge}
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/75 px-4 backdrop-blur-xl md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border-strong bg-surface/80 text-muted-foreground shadow-sm hover:text-foreground md:hidden"
            title="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="relative hidden w-full max-w-sm items-center sm:flex">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search deals, clients, files…"
              className="h-10 w-full rounded-xl border border-border bg-input pl-9 pr-14 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
            />
            <kbd className="num absolute right-2 rounded-full border border-border-strong bg-surface-raised px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* <Tag tone="neutral" className="hidden sm:inline-flex">
              {theme}
            </Tag> */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid h-10 w-10 place-items-center rounded-xl border border-border-strong bg-surface/80 text-muted-foreground shadow-sm hover:text-foreground"
              title="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <div className="relative">
              <button
                onClick={() => setAccountOpen((open) => !open)}
                className="flex h-10 items-center gap-2 rounded-xl border border-border-strong bg-surface/80 py-1 pl-1 pr-2.5 shadow-sm"
                title="Account menu"
              >
                <Avatar initials={initials} size="sm" tone="primary" />
                <span className="hidden text-xs font-medium lg:inline">{CURRENT_USER.display_name}</span>
              </button>
              {accountOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_24px_50px_-28px_rgba(15,23,42,0.55)]">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-sm font-medium">{session?.user.email || CURRENT_USER.display_name}</p>
                      <p className="label-tag text-muted-foreground">{CURRENT_USER.job_title || "Account"}</p>
                    </div>
                    <button
                      onClick={async () => {
                        setAccountOpen(false);
                        await signOut();
                      }}
                      className="w-full rounded-none border-0 px-3 py-2 text-left text-sm hover:bg-surface-raised"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>
        <motion.main
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8"
        >
          <style>{`
            .page-stagger > * {
              animation: fadeSlideUp 0.7s cubic-bezier(.16,1,.3,1) forwards;
              opacity: 0;
            }
            .page-stagger > *:nth-child(1) { animation-delay: 0.06s; }
            .page-stagger > *:nth-child(2) { animation-delay: 0.16s; }
            .page-stagger > *:nth-child(3) { animation-delay: 0.26s; }
            .page-stagger > *:nth-child(4) { animation-delay: 0.36s; }
            .page-stagger > *:nth-child(5) { animation-delay: 0.46s; }
            .page-stagger > *:nth-child(6) { animation-delay: 0.56s; }
            .page-stagger > *:nth-child(7) { animation-delay: 0.66s; }
            .page-stagger > *:nth-child(8) { animation-delay: 0.76s; }
          `}</style>
          <div className="page-stagger">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}

export default AppShellLaunchpad;
