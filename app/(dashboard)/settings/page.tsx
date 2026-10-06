"use client";

import Link from "next/link";
import { Plug, UserRoundCog, Users } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { Btn, PageHeader, Panel, PanelHead, Tag } from "@/components/kit.launchpad";

export default function SettingsPage() {
  const { profile, organisation, teamProfiles } = useApp();
  const isAdmin = profile?.role === "admin";

  const settings = [
    { label: "Workspace name", value: organisation?.name || "—" },
    { label: "Workspace type", value: organisation?.company_type || "—" },
    { label: "Workspace email", value: organisation?.email || "—" },
    { label: "Website", value: organisation?.website || "—" },
    { label: "Member count", value: String(teamProfiles.length) },
    { label: "Your role", value: profile?.role || "—" },
    { label: "Enabled modules", value: String(organisation?.enabled_features?.length || 0) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        variant="operations"
        eyebrow="Operations"
        title="Settings"
        desc="Workspace information, access and connected systems."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHead title="Workspace" />
          <div className="space-y-2 p-4 text-sm">
            {settings.map((setting) => (
              <div key={setting.label} className="grid grid-cols-[150px_1fr] gap-3 rounded-xl border border-border bg-surface p-3">
                <span className="text-muted-foreground">{setting.label}</span>
                <span className="truncate font-medium text-foreground">{setting.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHead title="Administration" />
            <div className="space-y-2 p-4">
              <Link href="/team" className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-surface-raised">
                <Users className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Team & permissions</p>
                  <p className="text-xs text-muted-foreground">{teamProfiles.length} registered members</p>
                </div>
                <Tag tone={isAdmin ? "success" : "neutral"}>{isAdmin ? "Manage" : "View"}</Tag>
              </Link>

              <Link href="/connections" className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-surface-raised">
                <Plug className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Connections</p>
                  <p className="text-xs text-muted-foreground">Supabase, Zoho Mail and Vercel status</p>
                </div>
              </Link>

              <Link href="/profile" className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-surface-raised">
                <UserRoundCog className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">My profile</p>
                  <p className="text-xs text-muted-foreground">{profile?.display_name || profile?.email || "Account"}</p>
                </div>
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Enabled modules" />
            <div className="flex flex-wrap gap-2 p-4">
              {(organisation?.enabled_features || []).map((feature) => (
                <Tag key={feature} tone="neutral">{feature}</Tag>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
