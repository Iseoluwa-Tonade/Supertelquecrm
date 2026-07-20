"use client";

import { useApp } from "@/lib/AppContext";
import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PIPELINE_COLUMNS, PROJECT_COLUMNS } from "@/lib/types";
import { label, money, todayIso, dateLabel, daysUntil, statusTitle, statusColor, dueLabel } from "@/lib/utils";
import { useToast } from "@/components/Toast";

const supabase = createClient();

export default function OverviewPage() {
  const {
    items, activities, profile, changeRequests, session,
    loadRemoteItems, loadRemoteActivities, loadChangeRequests,
  } = useApp();
  const { flash } = useToast();
  const role = profile?.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager" || role === "admin";
  const isViewer = role === "viewer";

  const doneStatuses = ["project_done", "project_delivered", "project_closed"];
  const doneCount = items.filter((item) => doneStatuses.includes(item.status)).length;
  const activeCount = items.filter((item) => !doneStatuses.includes(item.status)).length;
  const openValue = items
    .filter((item) => !doneStatuses.includes(item.status))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const expectedValue = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const actualValue = items
    .filter((item) => doneStatuses.includes(item.status))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const expectedProjects = items.filter((item) => item.type === "project").length;
  const actualProjects = items.filter((item) => item.type === "project" && doneStatuses.includes(item.status)).length;
  const expectedActivities = activities.length;
  const todayStr = todayIso();
  const todayActivities = activities.filter((a) => a.activity_date === todayStr);
  const completedToday = todayActivities.filter((a) => a.completed).length;
  const actualActivities = activities.filter((a) => a.completed).length;

  const addActivity = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isViewer) { flash("Viewers have read-only access"); return; }
    const form = new FormData(e.currentTarget);
    const title = form.get("title") as string;
    if (!title?.trim()) { flash("Add an activity title"); return; }
    const { error } = await supabase.from("crm_daily_activities").insert({
      title: title.trim(),
      channel: form.get("channel") || "general",
      activity_date: todayStr,
      completed: false,
    });
    if (error) { flash(error.message); return; }
    await loadRemoteActivities();
    flash("Activity added");
    (e.target as HTMLFormElement).reset();
  }, [isViewer, todayStr, loadRemoteActivities, flash]);

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
        <div className="border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4 text-crm-muted text-[14px] leading-[1.45]">
          {isManager
            ? "Manager dashboard: you can see team CRM records allowed by Supabase policies and approve pending team edits."
            : "Personal dashboard: you see approved records. Your edits are sent for manager approval before they change the board."}
        </div>

        <div className="kpi-grid grid grid-cols-4 max-md:grid-cols-1 gap-3">
          {renderKpi("Open accounts", activeCount)}
          {isAdmin
            ? renderKpi("Open value", money(openValue))
            : renderKpi("Open projects", expectedProjects)}
          {renderKpi("Done projects", doneCount)}
          {renderKpi("Today done", `${completedToday}/${todayActivities.length}`)}
          {renderKpi("Pending edits", changeRequests.filter((r) => r.status === "pending").length)}
          {renderKpi("Access", label(role || "owner"))}
        </div>

        <div className="dashboard-grid grid grid-cols-2 max-md:grid-cols-1 gap-[14px]">
          <ActivityPanel title="Expected vs Actual">
            <div className="metric-table grid gap-2">
              <div className="metric-row grid grid-cols-[minmax(90px,1fr)_minmax(78px,auto)_minmax(78px,auto)_minmax(74px,auto)] gap-[10px] items-center border border-crm-line rounded-[7px] p-[9px_10px] text-[12px] bg-crm-panel-strong text-crm-muted font-bold">
                <span>Area</span><span>Expected</span><span>Actual</span><span>Gap</span>
              </div>
              {isAdmin && renderMetricRow("Revenue", money(expectedValue), money(actualValue), money(expectedValue - actualValue))}
              {renderMetricRow("Projects", expectedProjects, actualProjects, expectedProjects - actualProjects)}
              {renderMetricRow("Activities", expectedActivities, actualActivities, expectedActivities - actualActivities)}
            </div>
          </ActivityPanel>

          <ActivityPanel title="Performance Graph">
            <div className="split-bars grid gap-[9px]">
              {isAdmin && renderDualBar("Revenue", expectedValue, actualValue, "#0f766e")}
              {renderDualBar("Projects", expectedProjects, actualProjects, "#2563eb")}
              {renderDualBar("Activities", expectedActivities, actualActivities, "#b45309")}
            </div>
          </ActivityPanel>
        </div>

        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3">
          <h2 className="m-0 text-[15px]">Client Journey</h2>
          <div className="journey-steps grid grid-cols-9 max-md:grid-cols-2 gap-2">
            {PIPELINE_COLUMNS.map((step) => {
              const count = items.filter((item) => item.status === step.id).length;
              return (
                <div key={step.id} className="border border-crm-line rounded-[7px] p-[10px_8px] min-h-[72px] grid content-between gap-2 bg-crm-panel-strong animate-[fadeInUp_0.3s_ease_both]">
                  <strong className="text-[18px]">{count}</strong>
                  <span className="text-crm-muted text-[11px] leading-[1.25]">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-grid grid grid-cols-2 max-md:grid-cols-1 gap-[14px]">
          <ActivityPanel title="Journey Graph">
            <div className="chart grid gap-[10px]">
              {renderStageChart(PIPELINE_COLUMNS, items)}
            </div>
          </ActivityPanel>
          <ActivityPanel title="Project Stage Graph">
            <div className="chart grid gap-[10px]">
              {renderStageChart(PROJECT_COLUMNS, items.filter((item) => item.type === "project"))}
            </div>
          </ActivityPanel>
        </div>

        <div className="overview-grid grid grid-cols-[1.15fr_0.85fr] max-md:grid-cols-1 gap-[14px]">
          <ActivityPanel title="Recently Active">
            <div className="activity-list grid gap-2">
              {items.slice(0, 6).map((item) => (
                <div key={item.id} className="border border-crm-line rounded-[7px] p-[10px] grid grid-cols-[auto_minmax(0,1fr)_auto] gap-[9px] items-start animate-[fadeInUp_0.3s_ease_both]">
                  <span className="w-[9px] h-[9px] rounded-full shrink-0 mt-[5px]" style={{ background: statusColor(item.status) }} />
                  <div>
                    <strong className="text-[13px] block">{item.company}</strong>
                    <span className="text-crm-muted text-[12px] block mt-[3px]">{item.title} - {statusTitle(item.status)}</span>
                  </div>
                  <span className="font-bold text-[13px]">{isAdmin && item.value ? money(item.value) : dueLabel(item.due)}</span>
                </div>
              )) || <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">No accounts yet. Create a card to start the journey.</div>}
            </div>
          </ActivityPanel>

          <ActivityPanel title="Today">
            <form onSubmit={addActivity} className="activity-form grid grid-cols-[1fr_130px_92px] max-md:grid-cols-1 gap-2">
              <input name="title" placeholder={isViewer ? "Sign in to save daily activity" : "Daily activity"} disabled={isViewer} required />
              <select name="channel" defaultValue="general" disabled={isViewer}>
                {["email", "call", "meeting", "proposal", "delivery", "admin", "general"].map((v) => (
                  <option key={v} value={v}>{label(v)}</option>
                ))}
              </select>
              <button type="submit" className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px]" disabled={isViewer}>
                Add
              </button>
            </form>
            <div className="activity-list grid gap-2">
              {todayActivities.length === 0 ? (
                <div className="text-crm-muted border border-dashed border-crm-line rounded-[var(--radius,8px)] p-4">No activities for this day yet.</div>
              ) : todayActivities.map((activity) => (
                <div key={activity.id} className={`border border-crm-line rounded-[7px] p-[10px] grid grid-cols-[auto_minmax(0,1fr)_auto] gap-[9px] items-start animate-[fadeInUp_0.3s_ease_both] ${activity.completed ? "opacity-60" : ""}`}>
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
                  <button
                    type="button"
                    onClick={() => deleteActivity(activity.id)}
                    className="w-[28px] min-h-[28px] text-crm-rose"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </ActivityPanel>
        </div>
      </section>
    </div>
  );
}

function renderKpi(labelText: string, value: string | number) {
  return (
    <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] animate-[fadeInUp_0.35s_ease_both]">
      <span className="text-crm-muted text-[12px] block">{labelText}</span>
      <strong className="block mt-[7px] text-[24px] leading-[1]">{value}</strong>
    </div>
  );
}

function renderMetricRow(area: string, expected: string | number, actual: string | number, gap: string | number) {
  return (
    <div className="grid grid-cols-[minmax(90px,1fr)_minmax(78px,auto)_minmax(78px,auto)_minmax(74px,auto)] gap-[10px] items-center border border-crm-line rounded-[7px] p-[9px_10px] text-[12px]">
      <strong className="text-[13px]">{area}</strong><span>{expected}</span><span>{actual}</span><span>{gap}</span>
    </div>
  );
}

function renderDualBar(labelText: string, expected: number, actual: number, color: string) {
  const max = Math.max(expected || 0, actual || 0, 1);
  const expectedWidth = Math.max(4, Math.round(((expected || 0) / max) * 100));
  const actualWidth = Math.max(4, Math.round(((actual || 0) / max) * 100));
  return (
    <div className="split-bar grid gap-[5px]">
      <div className="flex justify-between gap-[10px] text-crm-muted text-[12px]">
        <strong>{labelText}</strong>
        <span>Expected {formatCompact(expected)} / Actual {formatCompact(actual)}</span>
      </div>
      <div className="dual-track grid gap-[4px]">
        <div className="h-[10px] bg-[#e6edf4] rounded-[10px] overflow-hidden">
          <div className="h-full rounded-[10px] origin-left animate-[growBar_0.6s_cubic-bezier(.16,1,.3,1)_both]" style={{ width: `${expectedWidth}%`, background: "#94a3b8" }} />
        </div>
        <div className="h-[10px] bg-[#e6edf4] rounded-[10px] overflow-hidden">
          <div className="h-full rounded-[10px] origin-left animate-[growBar_0.6s_cubic-bezier(.16,1,.3,1)_both]" style={{ width: `${actualWidth}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function renderStageChart(stages: { id: string; title: string; color: string }[], items: { status: string }[]) {
  const counts = stages.map((stage) => ({
    ...stage,
    count: items.filter((item) => item.status === stage.id).length,
  }));
  const max = Math.max(...counts.map((s) => s.count), 1);
  return counts.map((stage) => {
    const width = Math.max(stage.count ? 8 : 2, Math.round((stage.count / max) * 100));
    return (
      <div key={stage.id} className="grid grid-cols-[minmax(88px,130px)_minmax(0,1fr)_42px] gap-[9px] items-center text-[12px]">
        <span className="text-crm-muted overflow-hidden text-ellipsis whitespace-nowrap">{stage.title}</span>
        <span className="h-[10px] bg-[#e6edf4] rounded-[10px] overflow-hidden">
          <span className="h-full block rounded-[10px] origin-left animate-[growBar_0.6s_cubic-bezier(.16,1,.3,1)_both]" style={{ width: `${width}%`, background: stage.color }} />
        </span>
        <strong>{stage.count}</strong>
      </div>
    );
  });
}

function ActivityPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
      <h2 className="m-0 text-[15px]">{title}</h2>
      {children}
    </div>
  );
}

function formatCompact(value: number): string {
  return value > 999
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : String(value);
}
