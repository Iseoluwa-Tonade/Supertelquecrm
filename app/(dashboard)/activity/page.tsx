"use client";

import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useCallback } from "react";
import { label, todayIso, dateLabel } from "@/lib/utils";

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
    <div className="board-scroll overflow-auto min-h-0">
      <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">New Activity</h2>
          <form onSubmit={addActivity} className="activity-form grid grid-cols-[1fr_130px_92px] max-md:grid-cols-1 gap-2">
            <input name="title" placeholder={canEdit ? "Daily activity" : "Sign in to save daily activity"} disabled={!canEdit} required />
            <select name="channel" defaultValue="general" disabled={!canEdit}>
              {["email", "call", "meeting", "proposal", "delivery", "admin", "general"].map((v) => (
                <option key={v} value={v}>{label(v)}</option>
              ))}
            </select>
            <button type="submit" disabled={!canEdit}
              className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] hover:brightness-105 disabled:bg-crm-panel-strong disabled:text-crm-muted disabled:border-crm-line disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>
        </div>

        {Object.keys(grouped).sort().reverse().length === 0 ? (
          <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">
            No daily activities yet. Add your first email, call, meeting, or delivery task.
          </div>
        ) : Object.keys(grouped).sort().reverse().map((date) => (
          <div key={date} className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
            <h2 className="m-0 text-[15px]">{dateLabel(date)}</h2>
            <div className="activity-list grid gap-2">
              {grouped[date].map((activity) => (
                <div key={activity.id} className={`border border-crm-line rounded-[7px] p-[10px] grid grid-cols-[auto_minmax(0,1fr)_auto] gap-[9px] items-start ${activity.completed ? "opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    checked={activity.completed}
                    onChange={(e) => toggleActivity(activity.id, e.target.checked)}
                    className="w-4 h-4 mt-[2px]"
                  />
                  <div>
                    <strong className={`text-[13px] block ${activity.completed ? "line-through text-crm-muted" : ""}`}>{activity.title}</strong>
                    <span className="text-crm-muted text-[12px] block mt-[3px]">{label(activity.channel)} - {dateLabel(activity.activity_date)}</span>
                  </div>
                  <button type="button" onClick={() => deleteActivity(activity.id)} className="w-[28px] min-h-[28px] text-crm-rose">&times;</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
