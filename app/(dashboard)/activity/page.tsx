"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback } from "react";
import { label, todayIso, dateLabel } from "@/lib/utils";
import { Panel, PanelHead, PageHeader, Tag, Btn, Input } from "@/components/kit.launchpad";

const supabase = createClient();

export default function ActivityPage() {
  const { activities, profile, session, loadRemoteActivities } = useApp();
  const { flash } = useToast();
  const isViewer = profile?.role === "viewer";
  const canEdit = Boolean(session) && !isViewer;

  const grouped = activities.reduce<Record<string, typeof activities>>((groups, activity) => {
    const key = activity.activity_date || todayIso();
    (groups[key] ||= []).push(activity);
    return groups;
  }, {});

  const addActivity = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit) { flash("Sign in to save activity"); return; }
    const form = new FormData(e.currentTarget);
    const title = (form.get("title") as string)?.trim();
    if (!title) { flash("Add an activity title"); return; }
    const { error } = await supabase.from("crm_daily_activities").insert({
      title,
      channel: form.get("channel") || "general",
      activity_date: todayIso(),
      completed: false,
    });
    if (error) { flash(error.message); return; }
    await loadRemoteActivities();
    flash("Activity added");
    (e.target as HTMLFormElement).reset();
  }, [canEdit, loadRemoteActivities, flash]);

  const toggleActivity = useCallback(async (id: string, completed: boolean) => {
    const { error } = await supabase.from("crm_daily_activities").update({ completed }).eq("id", id);
    if (error) { flash(error.message); return; }
    await loadRemoteActivities();
  }, [loadRemoteActivities, flash]);

  const deleteActivity = useCallback(async (id: string) => {
    const { error } = await supabase.from("crm_daily_activities").delete().eq("id", id);
    if (error) { flash(error.message); return; }
    await loadRemoteActivities();
    flash("Activity deleted");
  }, [loadRemoteActivities, flash]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Activity log"
        desc="Track daily emails, calls, meetings and deliveries."
      />

      {canEdit && (
        <Panel>
          <PanelHead title="New activity" />
          <form onSubmit={addActivity} className="grid gap-3 p-4">
            <div className="grid grid-cols-[1fr_130px] max-md:grid-cols-1 gap-3">
              <Input name="title" placeholder="What did you work on?" required />
              <select name="channel" defaultValue="general" className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                {["email", "call", "meeting", "proposal", "delivery", "admin", "general"].map((v) => (
                  <option key={v} value={v}>{label(v)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <Btn type="submit" variant="primary">Add</Btn>
            </div>
          </form>
        </Panel>
      )}

      {Object.keys(grouped).sort().reverse().length === 0 ? (
        <Panel className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No daily activities yet. Add your first email, call, meeting, or delivery task.</p>
        </Panel>
      ) : Object.keys(grouped).sort().reverse().map((date) => (
        <Panel key={date}>
          <PanelHead title={dateLabel(date)} />
          <div className="divide-y divide-border">
            {grouped[date].map((activity) => (
              <div key={activity.id} className={`flex items-start gap-3 px-4 py-3 ${activity.completed ? "opacity-60" : ""}`}>
                <input
                  type="checkbox"
                  checked={activity.completed}
                  onChange={(e) => toggleActivity(activity.id, e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${activity.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{activity.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Tag tone="neutral">{label(activity.channel)}</Tag>
                    <span className="ml-2">{dateLabel(activity.activity_date)}</span>
                  </p>
                </div>
                <Btn onClick={() => deleteActivity(activity.id)} variant="danger" size="sm">
                  &times;
                </Btn>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
