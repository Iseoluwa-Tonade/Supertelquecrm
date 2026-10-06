"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  KanbanSquare,
  FolderKanban,
  Activity,
  Files,
  MessageSquare,
  Mail,
  ShieldCheck,
  Users,
  Calculator,
  Search,
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
  Plug,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useApp } from "@/lib/AppContext";
import { canSeeView } from "@/lib/access";
import { Avatar, Tag, DropdownPanel } from "./kit.launchpad";

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Command center",
    items: [
      { to: "/overview", label: "Dashboard", icon: LayoutDashboard },
      { to: "/focus", label: "Focus board", icon: Activity },
      { to: "/activity", label: "Activity log", icon: Activity },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    group: "CRM & communication",
    items: [
      { to: "/clients", label: "Companies", icon: Building2 },
      { to: "/contacts", label: "Contacts", icon: Contact },
      { to: "/emails", label: "Email", icon: Mail },
      { to: "/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    group: "Revenue",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
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
      { to: "/documents", label: "Documents", icon: Files },
      { to: "/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    group: "Finance & reporting",
    items: [
      { to: "/invoicing", label: "Invoicing", icon: ReceiptText },
      { to: "/accounting", label: "Accounting", icon: Landmark },
      { to: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    group: "Workspace & automation",
    items: [
      { to: "/approvals", label: "Approvals", icon: ShieldCheck },
      { to: "/team", label: "Team & invites", icon: Users },
      { to: "/connections", label: "Connections", icon: Plug },
      { to: "/profile", label: "My profile", icon: Users },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppShellLaunchpad({ children }: { children: React.ReactNode }) {
  const { profile, organisation, session, theme, setTheme, signOut, notifications, items } = useApp();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [globalQuery, setGlobalQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const unreadNotifications = notifications.filter((n) => !n.read_at).length;
  const regComplete = profile?.registration_complete ?? true;
  const navItems: { group: string; items: NavItem[] }[] = regComplete
    ? NAV.map((group) => ({
        ...group,
        items: group.items
          .filter((item) => canSeeView(profile, organisation, item.to.slice(1)))
          .map((item) =>
            item.to === "/notifications" && unreadNotifications > 0
              ? { ...item, badge: unreadNotifications }
              : item
          ),
      })).filter((group) => group.items.length > 0)
    : [{ group: "Getting started", items: [{ to: "/profile", label: "My profile", icon: Users }] }];
  const flatNav = navItems.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group })));
  const normalizedGlobalQuery = globalQuery.trim().toLowerCase();
  const navMatches = normalizedGlobalQuery
    ? flatNav.filter((item) =>
        (item.label + " " + item.group).toLowerCase().includes(normalizedGlobalQuery)
      ).slice(0, 5)
    : flatNav.slice(0, 5);

  const itemMatches = normalizedGlobalQuery
    ? items.filter((item) =>
        [item.title, item.company, item.owner, item.status, item.type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedGlobalQuery))
      ).slice(0, 6)
    : [];

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function goToSearch(path: string) {
    const q = globalQuery.trim();
    router.push(q ? `${path}?q=${encodeURIComponent(q)}` : path);
    setSearchOpen(false);
  }

  function goToItem(item: { id: string; type: string }) {
    const path =
      item.type === "deal" ? `/pipeline/${item.id}` :
      item.type === "project" ? `/projects/${item.id}` :
      `/tasks/${item.id}`;
    router.push(path);
    setSearchOpen(false);
  }

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_-6%,rgba(13,148,136,.08),transparent_28%),radial-gradient(circle_at_92%_0%,rgba(37,99,235,.05),transparent_24%)]" />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-white/8 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,.11),transparent_22%),linear-gradient(180deg,#101827_0%,#0b1220_72%)] text-crm-sidebar-text shadow-[18px_0_50px_-38px_rgba(2,8,23,.9)] md:flex",
          "w-[264px]",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/8 px-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,#2dd4bf,#0d9488)] text-white shadow-[0_12px_28px_-14px_rgba(45,212,191,.72)] ring-1 ring-white/15">
            <Command className="h-[17px] w-[17px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] leading-tight">{CURRENT_ORG.name}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[.16em] text-crm-sidebar-muted/70">{CURRENT_ORG.company_type || "workspace"}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navItems.map((section) => (
            <div key={section.group}>
              <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[.17em] text-crm-sidebar-muted/55">{section.group}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  return (
                    <li key={item.to}>
                      <Link
                        href={item.to}
                        title={item.label}
                        className={cn(
                            "group relative flex min-h-10 items-center gap-3 rounded-[13px] px-3 py-2 text-[13px] font-medium transition-[background,color,transform,box-shadow] duration-200",
                          active
                              ? "bg-white/[.10] text-white shadow-[0_10px_26px_-18px_rgba(45,212,191,.65)] ring-1 ring-white/[.06]"
                              : "text-crm-sidebar-muted hover:translate-x-0.5 hover:bg-white/[.055] hover:text-white",
                        )}
                      >
                        {active ? (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_14px_rgba(45,212,191,.7)]" />
                        ) : null}
                        <item.icon className="h-[17px] w-[17px] shrink-0 opacity-90" />
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
              className="fixed inset-y-0 left-0 z-50 flex h-screen w-[272px] flex-col border-r border-white/8 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,.11),transparent_22%),linear-gradient(180deg,#101827_0%,#0b1220_72%)] text-crm-sidebar-text shadow-2xl md:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-white/8 px-4">
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

              <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
                {navItems.map((section) => (
                  <div key={section.group}>
                    <p className="label-tag mb-2 px-2 text-crm-sidebar-muted/80">{section.group}</p>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = pathname === item.to || pathname.startsWith(item.to + "/");
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
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-border/80 bg-background/82 px-4 shadow-[0_8px_24px_-22px_rgba(16,24,40,.25)] backdrop-blur-2xl md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border-strong bg-surface/80 text-muted-foreground shadow-sm hover:text-foreground md:hidden"
            title="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="relative hidden w-full max-w-sm items-center sm:flex">
            <Search className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchRef}
              value={globalQuery}
              onChange={(event) => {
                setGlobalQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (itemMatches[0]) goToItem(itemMatches[0]);
                  else if (navMatches[0]) {
                    router.push(navMatches[0].to);
                    setSearchOpen(false);
                  } else goToSearch("/contacts");
                }
              }}
              placeholder="Search CRM, email, deals, projects…"
              className="h-10 w-full rounded-[14px] border border-border/90 bg-surface/85 pl-9 pr-14 text-sm shadow-[0_1px_2px_rgba(16,24,40,.03)] outline-none placeholder:text-muted-foreground/65 hover:border-primary/25 focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
            <kbd className="num pointer-events-none absolute right-2 rounded-md border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm">⌘K</kbd>

            {searchOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default bg-transparent"
                  aria-label="Close global search"
                  onClick={() => setSearchOpen(false)}
                />
                <div className="absolute left-0 top-12 z-40 w-[min(560px,80vw)] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Global search</p>
                  </div>

                  {globalQuery.trim() ? (
                    <div className="grid grid-cols-3 gap-1 border-b border-border p-2">
                      <button type="button" onClick={() => goToSearch("/contacts")} className="rounded-xl px-3 py-2 text-left text-xs hover:bg-surface-raised">
                        <span className="font-semibold">Contacts</span><span className="block truncate text-muted-foreground">{globalQuery}</span>
                      </button>
                      <button type="button" onClick={() => goToSearch("/clients")} className="rounded-xl px-3 py-2 text-left text-xs hover:bg-surface-raised">
                        <span className="font-semibold">Companies</span><span className="block truncate text-muted-foreground">{globalQuery}</span>
                      </button>
                      <button type="button" onClick={() => goToSearch("/emails")} className="rounded-xl px-3 py-2 text-left text-xs hover:bg-surface-raised">
                        <span className="font-semibold">Email</span><span className="block truncate text-muted-foreground">{globalQuery}</span>
                      </button>
                    </div>
                  ) : null}

                  <div className="max-h-80 overflow-y-auto p-2">
                    {itemMatches.length ? (
                      <div className="mb-2">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Records</p>
                        {itemMatches.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => goToItem(item)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-raised"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{item.company || item.type}</p>
                            </div>
                            <span className="text-[10px] uppercase text-muted-foreground">{item.type}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Pages</p>
                    {navMatches.map((item) => (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => {
                          router.push(item.to);
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-raised"
                      >
                        <item.icon className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.group}</p>
                        </div>
                      </button>
                    ))}
                    {!navMatches.length && !itemMatches.length ? (
                      <p className="px-3 py-5 text-center text-sm text-muted-foreground">No direct match. Use Contacts, Companies, or Email search above.</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* <Tag tone="neutral" className="hidden sm:inline-flex">
              {theme}
            </Tag> */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid h-10 w-10 place-items-center rounded-[13px] border border-border bg-surface/90 text-muted-foreground shadow-[0_1px_2px_rgba(16,24,40,.04)] hover:-translate-y-px hover:border-primary/25 hover:text-foreground"
              title="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <div className="relative">
              <button
                onClick={() => setAccountOpen((open) => !open)}
                className="flex h-10 items-center gap-2 rounded-[13px] border border-border bg-surface/90 py-1 pl-1 pr-2.5 shadow-[0_1px_2px_rgba(16,24,40,.04)] hover:-translate-y-px hover:border-primary/25"
                title="Account menu"
              >
                <Avatar initials={initials} size="sm" tone="primary" />
                <span className="hidden text-xs font-medium lg:inline">{CURRENT_USER.display_name}</span>
              </button>
              {accountOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <DropdownPanel className="absolute right-0 z-50 mt-2 w-64">
                    <div className="border-b border-white/10 px-3 py-2.5">
                      <p className="truncate text-sm font-medium">{session?.user.email || CURRENT_USER.display_name}</p>
                      <p className="label-tag text-muted-foreground">{CURRENT_USER.job_title || "Account"}</p>
                    </div>
                    <button
                      onClick={async () => {
                        setAccountOpen(false);
                        await signOut();
                      }}
                      className="w-full rounded-none border-0 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                    >
                      Sign out
                    </button>
                  </DropdownPanel>
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
          className="flex-1 overflow-y-auto px-4 py-6 md:px-7 lg:px-9"
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
          <div className="page-stagger mx-auto w-full max-w-[1680px] pb-10">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}

export default AppShellLaunchpad;
