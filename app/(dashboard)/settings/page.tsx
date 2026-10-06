"use client";

import { useApp } from "@/lib/AppContext";
import { PageHeader, Panel, PanelHead } from "@/components/kit.launchpad";

export default function SettingsPage() {
  const { profile, organisation, teamProfiles } = useApp();

  const settings = [
    { label: "Workspace name", value: organisation?.name || "—" },
    { label: "Workspace type", value: organisation?.company_type || "—" },
    { label: "Member count", value: String(teamProfiles.length) },
    { label: "Enabled modules", value: String(organisation?.enabled_features?.length || 0) },
    { label: "Your role", value: profile?.role || "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        variant="operations"
        eyebrow="Operations"
        title="Settings"
        desc="Live workspace and account settings."
      />

      <Panel>
        <PanelHead title="Workspace" />
        <div className="space-y-1 p-4 text-sm">
          {settings.map((s) => (
            <div key={s.label} className="grid grid-cols-[160px_1fr] gap-2 rounded-lg border border-border bg-surface p-2">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
