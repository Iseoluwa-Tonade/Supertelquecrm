"use client";

import { useEffect, useState } from "react";
import { KeyRound, Sparkles } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { useToast } from "@/components/Toast";
import { PageHeader, Panel, PanelHead, Btn, Input, Field, DropdownSelect, Tag } from "@/components/kit.launchpad";

type AiSettings = {
  configured: boolean;
  provider: string;
  model: string;
  enabled: boolean;
  analyze_new_email: boolean;
  updated_at: string | null;
};

export default function SettingsPage() {
  const { profile, organisation, teamProfiles } = useApp();
  const { flash } = useToast();
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-6-luna");
  const [enabled, setEnabled] = useState(true);
  const [analyzeNewEmail, setAnalyzeNewEmail] = useState(true);
  const [savingAi, setSavingAi] = useState(false);

  const isAdmin = profile?.role === "admin";

  const settings = [
    { label: "Workspace name", value: organisation?.name || "—" },
    { label: "Workspace type", value: organisation?.company_type || "—" },
    { label: "Member count", value: String(teamProfiles.length) },
    { label: "Enabled modules", value: String(organisation?.enabled_features?.length || 0) },
    { label: "Your role", value: profile?.role || "—" },
  ];

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/ai/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.error) return;
        setAi(data);
        setModel(data.model || "gpt-6-luna");
        setEnabled(data.enabled !== false);
        setAnalyzeNewEmail(data.analyze_new_email !== false);
      })
      .catch(() => null);
  }, [isAdmin]);

  async function saveAi() {
    if (!isAdmin) return;
    setSavingAi(true);
    try {
      const response = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey.trim() || undefined,
          model,
          enabled,
          analyze_new_email: analyzeNewEmail,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        flash(data?.error || "Could not save AI settings");
        return;
      }
      setAi({ ...data, updated_at: new Date().toISOString() });
      setApiKey("");
      flash("AI email intelligence settings saved");
    } finally {
      setSavingAi(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="operations"
        eyebrow="Operations"
        title="Settings"
        desc="Live workspace, automation and AI settings."
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

      {isAdmin ? (
        <Panel>
          <PanelHead
            title="AI email intelligence"
            hint="Runs only when a new email arrives in a synced thread"
            action={<Tag tone={ai?.configured ? "success" : "warning"}>{ai?.configured ? "API key configured" : "API key required"}</Tag>}
          />
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <Field label="OpenAI API key">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={ai?.configured ? "Stored securely — enter a new key to replace it" : "sk-..."}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </Field>

            <Field label="Model">
              <DropdownSelect
                value={model}
                onChange={setModel}
                ariaLabel="OpenAI model"
                placeholder="Choose model"
                options={[
                  { value: "gpt-6-luna", label: "GPT-6 Luna — low-cost email analysis" },
                  { value: "gpt-6.1-sol", label: "GPT-6.1 Sol — stronger reasoning" },
                  { value: "gpt-6-astra", label: "GPT-6 Astra — highest capability" },
                ]}
              />
            </Field>

            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold">Enable AI intelligence</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Store a thread summary, next action and an optional suggested reply.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <input
                type="checkbox"
                checked={analyzeNewEmail}
                onChange={(event) => setAnalyzeNewEmail(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold">Analyze only new email events</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Unchanged threads are not repeatedly sent to OpenAI, which controls cost.
                </span>
              </span>
            </label>

            <div className="lg:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">How it runs</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    New Zoho email → CRM sync → Contact/Company matching → thread AI analysis → suggested next action/reply.
                  </p>
                </div>
              </div>
              <Btn variant="primary" onClick={saveAi} disabled={savingAi || (!ai?.configured && !apiKey.trim())}>
                {savingAi ? "Saving…" : "Save AI settings"}
              </Btn>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
