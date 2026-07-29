"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { money, label } from "@/lib/utils";
import { PageHeader, Panel, PanelHead, Tag, Avatar, Btn } from "@/components/kit.launchpad";
import { Search, Building2, Plus } from "lucide-react";

export default function ClientsPage() {
  const { items, profile } = useApp();
  const [query, setQuery] = useState("");
  const isAdmin = profile?.role === "admin";

  const clients = useMemo(() => {
    const map = new Map<string, { company: string; deals: number; value: number; owners: string[]; lastTouch: string }>();
    items.forEach((item) => {
      const c = item.company || "Unknown";
      if (!map.has(c)) map.set(c, { company: c, deals: 0, value: 0, owners: [], lastTouch: "" });
      const entry = map.get(c)!;
      entry.deals++;
      entry.value += Number(item.value || 0);
      if (item.owner && !entry.owners.includes(item.owner)) entry.owners.push(item.owner);
      if (item.due && item.due > entry.lastTouch) entry.lastTouch = item.due;
    });
    return Array.from(map.values());
  }, [items]);

  const filtered = query ? clients.filter((c) => c.company.toLowerCase().includes(query.toLowerCase())) : clients;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue"
        title="Clients"
        desc="Accounts and companies you work with."
        actions={
          <Btn variant="primary" size="sm">
            <Plus className="h-4 w-4" /> Add client
          </Btn>
        }
      />

      <Panel>
        <PanelHead
          title={`All accounts (${filtered.length})`}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search accounts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-48 rounded-md border border-border bg-input pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
              />
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Account</th>
                <th className="px-4 py-2.5 text-left font-medium">Deals</th>
                <th className="px-4 py-2.5 text-left font-medium">Owners</th>
                <th className="px-4 py-2.5 text-right font-medium">{isAdmin ? "Value" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No accounts found.</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.company} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-raised text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-foreground">{c.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.deals}</td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-1.5">
                      {c.owners.slice(0, 3).map((o) => (
                        <Avatar key={o} initials={o.slice(0, 2).toUpperCase()} size="sm" />
                      ))}
                      {c.owners.length > 3 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-[10px] text-muted-foreground ring-1 ring-border">+{c.owners.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin ? <span className="num text-foreground">{money(c.value)}</span> : <span className="text-muted-foreground">•••••</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {!isAdmin && <p className="text-xs text-muted-foreground px-1">Contract values are only visible to admins.</p>}
    </div>
  );
}
