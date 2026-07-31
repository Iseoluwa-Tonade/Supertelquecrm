"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { label } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Tag, Avatar, Btn } from "@/components/kit.launchpad";
import { Search, Mail, Phone, Plus } from "lucide-react";

const STATUS_TONES: Record<string, string> = {
  active: "success",
  invited: "primary",
  suspended: "danger",
  uninvited: "neutral",
};

export default function ContactsPage() {
  const { teamProfiles, items, profile } = useApp();
  const [query, setQuery] = useState("");
  const isAdmin = profile?.role === "admin";

  const contacts = useMemo(() => {
    return teamProfiles.map((p) => ({
      name: p.display_name || p.email || "Team member",
      email: p.email || "",
      title: p.job_title || "—",
      department: p.department || "—",
      phone: p.phone || "—",
      status: p.status || "active",
    }));
  }, [teamProfiles]);

  const filtered = query
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.email.toLowerCase().includes(query.toLowerCase()) ||
          c.title.toLowerCase().includes(query.toLowerCase())
      )
    : contacts;

  const inboundLeads = useMemo(() => {
    const recentItems = items.filter((i) => i.type === "deal").slice(0, 4);
    return recentItems.map((i) => ({
      name: i.title,
      company: i.company,
      value: Number(i.value || 0),
      owner: i.owner,
    }));
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader variant="revenue"
        eyebrow="Revenue"
        title="Contacts & leads"
        desc="Your team directory and inbound opportunities."
        actions={
          <Btn variant="primary" size="sm">
            <Plus className="h-4 w-4" /> New contact
          </Btn>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <PanelHead
            title={`Contacts (${filtered.length})`}
            action={
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search contacts…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 w-44 rounded-md border border-border bg-input pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
                />
              </div>
            }
          />
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No contacts found.</div>
            ) : filtered.map((c) => (
              <div key={c.email} className="flex items-center gap-3 px-4 py-3">
                <Avatar initials={c.name.slice(0, 2).toUpperCase()} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.title} · {c.department}</p>
                </div>
                <Tag tone={STATUS_TONES[c.status] || "neutral"}>{label(c.status)}</Tag>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <a href={`mailto:${c.email}`} className="grid h-7 w-7 place-items-center rounded hover:bg-surface-raised hover:text-foreground transition-colors"><Mail className="h-3.5 w-3.5" /></a>
                  {c.phone !== "—" && <a href={`tel:${c.phone}`} className="grid h-7 w-7 place-items-center rounded hover:bg-surface-raised hover:text-foreground transition-colors"><Phone className="h-3.5 w-3.5" /></a>}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="h-fit">
          <PanelHead title="Inbound leads" hint="Recent deal opportunities" />
          <div className="divide-y divide-border">
            {inboundLeads.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No leads yet.</div>
            ) : inboundLeads.map((lead) => (
              <div key={lead.name} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{lead.name}</p>
                  <Tag tone={lead.value > 50000 ? "success" : lead.value > 10000 ? "warning" : "neutral"}>
                    {lead.value > 50000 ? "Hot" : lead.value > 10000 ? "Warm" : "Cool"}
                  </Tag>
                </div>
                <p className="text-xs text-muted-foreground">{lead.company}</p>
                {isAdmin && <p className="num text-xs text-foreground">{lead.value}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar initials={lead.owner.slice(0, 2).toUpperCase()} size="sm" />
                  <span>{lead.owner}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
