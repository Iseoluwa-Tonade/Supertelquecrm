"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { PageHeader, Panel, PanelHead, Btn, Input, Field, DropdownSelect, Tag } from "@/components/kit.launchpad";

const supabase = createClient();

type ReportRow = {
  id: string;
  title: string;
  report_type: string;
  period_label: string | null;
  status: "draft" | "final" | "archived";
  document_id: string | null;
  created_at: string;
};

export default function ReportsPage() {
  const { organisation, session, profile, documents } = useApp();
  const { flash } = useToast();
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState("report");
  const [periodLabel, setPeriodLabel] = useState("");
  const [status, setStatus] = useState("draft");
  const [documentId, setDocumentId] = useState("");

  const load = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_reports")
      .select("*")
      .eq("organisation_id", organisation.id)
      .order("created_at", { ascending: false });
    if (error) flash(error.message);
    setReports((data || []) as ReportRow[]);
    setLoading(false);
  }, [organisation?.id, flash]);

  useEffect(() => { load(); }, [load]);

  async function addReport(event: React.FormEvent) {
    event.preventDefault();
    if (!organisation?.id || !session?.user.id || !canManage) return;
    const { error } = await supabase.from("crm_reports").insert({
      organisation_id: organisation.id,
      title: title.trim(),
      report_type: reportType,
      period_label: periodLabel.trim() || null,
      status,
      document_id: documentId || null,
      created_by: session.user.id,
    });
    if (error) { flash(error.message); return; }
    setTitle(""); setPeriodLabel(""); setDocumentId(""); setStatus("draft");
    setShowForm(false);
    await load();
    flash("Report saved");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="operations"
        eyebrow="Operations"
        title="Reports"
        desc="Live report records and linked documents."
        actions={
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Btn>
            {canManage && <Btn variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4" />New report</Btn>}
          </div>
        }
      />

      {showForm && (
        <Panel>
          <PanelHead title="Create report record" />
          <form onSubmit={addReport} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
            <DropdownSelect value={reportType} onChange={setReportType} ariaLabel="Report type" options={[{ value: "report", label: "Report" }, { value: "pdf", label: "PDF" }, { value: "slides", label: "Slides" }, { value: "spreadsheet", label: "Spreadsheet" }]} />
            <Field label="Period"><Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="e.g. Oct 2026" /></Field>
            <DropdownSelect value={status} onChange={setStatus} ariaLabel="Report status" options={[{ value: "draft", label: "Draft" }, { value: "final", label: "Final" }, { value: "archived", label: "Archived" }]} />
            <div className="md:col-span-2 xl:col-span-4">
              <DropdownSelect value={documentId} onChange={setDocumentId} ariaLabel="Linked document" placeholder="No linked document" options={[{ value: "", label: "No linked document" }, ...documents.map((d) => ({ value: d.id, label: d.file_name }))]} />
            </div>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2"><Btn type="button" onClick={() => setShowForm(false)}>Cancel</Btn><Btn type="submit" variant="primary">Save report</Btn></div>
          </form>
        </Panel>
      )}

      <Panel>
        <PanelHead title={`All reports (${reports.length})`} hint="No seeded demo reports" />
        <div className="divide-y divide-border">
          {reports.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No live reports yet.</div>
          ) : reports.map((r) => {
            const linked = documents.find((d) => d.id === r.document_id);
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.report_type} · {r.period_label || "No period"}{linked ? ` · ${linked.file_name}` : ""}</p>
                </div>
                <Tag tone={r.status === "final" ? "success" : r.status === "draft" ? "warning" : "neutral"}>{r.status}</Tag>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
