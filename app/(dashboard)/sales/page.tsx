"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, TrendingUp, X } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { PIPELINE_COLUMNS } from "@/lib/types";
import { money, label, dateLabel } from "@/lib/utils";
import { Btn, Field, Input, PageHeader, Panel, PanelHead, Stat, Tag, Textarea, DropdownSelect } from "@/components/kit.launchpad";

const supabase = createClient();

export default function SalesPage() {
  const { items, profile, organisation, loadRemoteItems } = useApp();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("responded_email");
  const [notes, setNotes] = useState("");

  const deals = useMemo(
    () => items.filter((item) => item.type === "deal"),
    [items]
  );

  const activeDeals = useMemo(
    () => deals.filter((item) => !["project_done", "project_delivered", "project_closed"].includes(item.status)),
    [deals]
  );

  const metrics = useMemo(() => {
    const pipelineValue = activeDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
    const highPriority = activeDeals.filter((deal) => deal.priority === "high").length;
    const proposalCount = activeDeals.filter((deal) => deal.status === "proposal_sent").length;
    return { pipelineValue, highPriority, proposalCount };
  }, [activeDeals]);

  async function createDeal() {
    if (!canManage || !profile?.user_id || !organisation?.id) return;
    if (!title.trim() || !company.trim()) return flash("Deal title and company are required");

    setSaving(true);
    const { data, error } = await supabase
      .from("crm_board_items")
      .insert({
        organisation_id: organisation.id,
        type: "deal",
        title: title.trim(),
        company: company.trim(),
        owner: profile.display_name || profile.email || "Owner",
        assigned_to: profile.user_id,
        priority,
        value: Number(value) || 0,
        due: due || null,
        status,
        notes: notes.trim(),
        visibility: "team",
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      return flash(error.message);
    }

    setTitle("");
    setCompany("");
    setValue("");
    setDue("");
    setPriority("medium");
    setStatus("responded_email");
    setNotes("");
    setOpen(false);
    setSaving(false);
    await loadRemoteItems();
    flash("Deal created");

    if (data?.id) window.location.href = "/pipeline/" + data.id;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="revenue"
        eyebrow="Revenue"
        title="Sales"
        desc="Create opportunities and move them through the shared revenue pipeline."
        actions={
          canManage ? (
            <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New deal
            </Btn>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active deals" value={String(activeDeals.length)} delta="Open opportunities" spark={[2,3,4,4,5,6]} />
        <Stat label="Pipeline value" value={money(metrics.pipelineValue)} delta="Open revenue" spark={[3,4,5,5,6,7]} />
        <Stat label="Proposal stage" value={String(metrics.proposalCount)} delta="Proposal sent" spark={[1,1,2,2,3,3]} />
        <Stat label="High priority" value={String(metrics.highPriority)} delta="Needs attention" spark={[1,2,2,3,2,3]} positive={metrics.highPriority === 0} />
      </div>

      <Panel>
        <PanelHead
          title={"Revenue opportunities (" + deals.length + ")"}
          action={<Link href="/pipeline"><Btn size="sm">Open pipeline</Btn></Link>}
        />
        <div className="divide-y divide-border">
          {deals.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No deals yet. {canManage ? "Create the first opportunity above." : ""}
            </div>
          ) : deals.map((deal) => (
            <Link
              key={deal.id}
              href={"/pipeline/" + deal.id}
              className="grid gap-3 px-4 py-4 transition-colors hover:bg-surface-raised/60 md:grid-cols-[minmax(0,1fr)_160px_140px_140px]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{deal.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{deal.company}</p>
              </div>
              <div>
                <Tag tone="primary">{label(deal.status)}</Tag>
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="num text-sm text-foreground">{money(deal.value || 0)}</p>
                <p>{deal.due ? dateLabel(deal.due) : "No due date"}</p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Tag tone={deal.priority === "high" ? "danger" : deal.priority === "medium" ? "warning" : "neutral"}>
                  {deal.priority}
                </Tag>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      {open ? (
        <div className="fixed inset-0 z-80 grid place-items-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-popover shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="label-tag text-primary">Revenue pipeline</p>
                <h2 className="mt-1 text-lg font-semibold">New deal</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface-raised">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Deal title">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Managed operations proposal" />
              </Field>
              <Field label="Company">
                <Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" />
              </Field>
              <Field label="Value">
                <Input value={value} onChange={(event) => setValue(event.target.value)} type="number" min="0" placeholder="0" />
              </Field>
              <Field label="Due date">
                <Input value={due} onChange={(event) => setDue(event.target.value)} type="date" />
              </Field>
              <Field label="Priority">
                <DropdownSelect
                  value={priority}
                  onChange={setPriority}
                  ariaLabel="Priority"
                  placeholder="Select priority"
                  options={["high","medium","low"].map((item) => ({ value:item, label:label(item) }))}
                />
              </Field>
              <Field label="Stage">
                <DropdownSelect
                  value={status}
                  onChange={setStatus}
                  ariaLabel="Pipeline stage"
                  placeholder="Select stage"
                  options={PIPELINE_COLUMNS.map((column) => ({ value:column.id, label:column.title }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Context, next step or discovery notes…" />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Btn onClick={() => setOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={createDeal} disabled={!title.trim() || !company.trim() || saving}>
                {saving ? "Creating…" : "Create deal"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
