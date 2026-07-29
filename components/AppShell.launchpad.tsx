"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useApp } from "@/lib/AppContext";
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
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border bg-surface/60 transition-[width] duration-200 md:flex",
          railOpen ? "w-60" : "w-16",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-primary text-primary-foreground">
            <Command className="h-4 w-4" />
          </span>
          {railOpen ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{CURRENT_ORG.name}</p>
              <p className="label-tag text-muted-foreground">{CURRENT_ORG.company_type || "workspace"} workspace</p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV.map((section) => (
            <div key={section.group}>
              {railOpen ? (
                <p className="label-tag mb-2 px-2 text-muted-foreground/70">{section.group}</p>
              ) : (
                <div className="mx-2 mb-2 h-px bg-border" />
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
                          "group relative flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary/12 text-primary"
                            : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
                        )}
                      >
                        {active ? (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                        ) : null}
                        <item.icon className="h-4 w-4 shrink-0" />
                        {railOpen ? <span className="truncate">{item.label}</span> : null}
                        {railOpen && item.badge ? (
                          <span className="num ml-auto rounded bg-primary/20 px-1.5 text-[10px] text-primary">
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
          className="flex h-11 items-center gap-2.5 border-t border-border px-4 text-xs text-muted-foreground hover:text-foreground"
        >
          {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          {railOpen ? "Collapse" : null}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <div className="relative hidden w-full max-w-sm items-center sm:flex">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search deals, clients, files…"
              className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-14 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
            />
            <kbd className="num absolute right-2 rounded border border-border-strong px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Tag tone="neutral" className="hidden sm:inline-flex">
              {theme}
            </Tag>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid h-9 w-9 place-items-center rounded-md border border-border-strong text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <div className="relative">
              <button
                onClick={() => setAccountOpen((open) => !open)}
                className="flex h-9 items-center gap-2 rounded-md border border-border-strong py-1 pl-1 pr-2.5"
                title="Account menu"
              >
                <Avatar initials={initials} size="sm" tone="primary" />
                <span className="hidden text-xs font-medium lg:inline">{CURRENT_USER.display_name}</span>
              </button>
              {accountOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
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
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export default AppShellLaunchpad;
