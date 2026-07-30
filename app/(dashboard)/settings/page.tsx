"use client";

import { useApp } from "@/lib/AppContext";
import { PageHeader, Panel, PanelHead } from "@/components/kit.launchpad";

export default function SettingsPage() {
  const { profile, organisation } = useApp();

  const settings = [
    { label: "Workspace name", value: organisation?.name || "—" },
    { label: "Plan", value: "Professional" },
    { label: "Member count", value: "—" },
    { label: "Your role", value: profile?.role || "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader variant="operations"
        eyebrow="Operations"
        title="Settings"
        desc="Workspace and account preferences."
      />

      <Panel>
        <PanelHead title="Workspace" />
        <div className="space-y-1 p-4 text-sm">
          {settings.map((s) => (
            <div key={s.label} className="grid grid-cols-[140px_1fr] gap-2 rounded-lg border border-border bg-surface p-2">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
