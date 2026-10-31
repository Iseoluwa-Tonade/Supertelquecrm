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

  return <div className="space-y-6">
    <PageHeader variant="operations" eyebrow="Workspace" title="Settings" desc="Your workspace details." />
    <Panel><PanelHead title="Workspace" /><dl className="space-y-2 p-4 text-sm">
      {settings.map(s => <div key={s.label} className="grid grid-cols-[160px_1fr] gap-2"><dt className="text-muted-foreground">{s.label}</dt><dd>{s.value}</dd></div>)}
    </dl></Panel>
  </div>;
}
