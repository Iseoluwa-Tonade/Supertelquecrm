"use client";
import { useState } from "react";
import { Btn, PageHeader, Panel, PanelHead } from "@/components/kit.launchpad";
export default function ConnectionsPage() {
  const [copied, setCopied] = useState(false);
  return <div className="space-y-6">
    <PageHeader variant="operations" eyebrow="Workspace" title="Connections" desc="Connect ChatGPT to your CRM records." />
    <Panel><PanelHead title="CRM MCP connection" /><div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">Access contacts, companies, pipeline and tasks using your CRM account permissions.</p>
      <code className="block break-all">https://crm.supertelque.com/api/mcp</code>
      <Btn onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/api/mcp`); setCopied(true); }}>{copied ? "Copied" : "Copy connection URL"}</Btn>
    </div></Panel>
  </div>;
}
