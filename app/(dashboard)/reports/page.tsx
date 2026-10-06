"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, FileText, FolderKanban, MessageSquare, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { useApp } from "@/lib/AppContext";
import { money, todayIso } from "@/lib/utils";
import { Btn, PageHeader, Panel, PanelHead, Stat } from "@/components/kit.launchpad";

export default function ReportsPage() {
  const { items, activities, documents, messages, changeRequests, teamProfiles, profile } = useApp();
  const canSeeRevenue = profile?.role === "admin" || profile?.role === "manager";

  const deals = items.filter((item) => item.type === "deal");
  const projects = items.filter((item) => item.type === "project");
  const tasks = items.filter((item) => item.type === "task");
  const activeDeals = deals.filter((item) => !["project_done","project_delivered","project_closed"].includes(item.status));
  const pipelineValue = activeDeals.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const openProjects = projects.filter((item) => !["project_delivered","project_closed"].includes(item.status));
  const openTasks = tasks.filter((item) => item.status !== "done");
  const pendingApprovals = changeRequests.filter((request) => request.status === "pending").length;
  const unreadMessages = messages.filter((message) => message.recipient_id === profile?.user_id && !message.read_at).length;
  const todayActivity = activities.filter((activity) => activity.activity_date === todayIso()).length;

  const reports = [
    {
      title: "Revenue pipeline",
      href: "/pipeline",
      icon: TrendingUp,
      metrics: [
        [String(activeDeals.length), "active deals"],
        [canSeeRevenue ? money(pipelineValue) : "Restricted", "open value"],
      ],
    },
    {
      title: "Delivery",
      href: "/projects",
      icon: FolderKanban,
      metrics: [
        [String(openProjects.length), "open projects"],
        [String(openTasks.length), "open tasks"],
      ],
    },
    {
      title: "Communications",
      href: "/emails",
      icon: MessageSquare,
      metrics: [
        [String(unreadMessages), "unread internal"],
        [String(todayActivity), "today's activities"],
      ],
    },
    {
      title: "Operations",
      href: "/approvals",
      icon: ShieldCheck,
      metrics: [
        [String(pendingApprovals), "pending approvals"],
        [String(documents.length), "documents"],
      ],
    },
    {
      title: "Team",
      href: "/team",
      icon: Users,
      metrics: [
        [String(teamProfiles.length), "members"],
        [String(activities.length), "logged activities"],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        variant="operations"
        eyebrow="Operations"
        title="Reports"
        desc="Live reporting views generated from the CRM database."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="CRM records" value={String(items.length)} delta="Deals, projects and tasks" spark={[1,2,3,4,4,5]} />
        <Stat label="Activities" value={String(activities.length)} delta="Logged operations" spark={[1,1,2,3,3,4]} />
        <Stat label="Documents" value={String(documents.length)} delta="Stored files" spark={[1,2,2,2,3,3]} />
        <Stat label="Approvals" value={String(pendingApprovals)} delta="Pending review" spark={[1,1,2,1,2,1]} positive={pendingApprovals === 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Panel key={report.title} className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <report.icon className="h-5 w-5" />
                </span>
                <Link href={report.href}>
                  <Btn size="sm" variant="outline">
                    Open <ArrowUpRight className="h-3.5 w-3.5" />
                  </Btn>
                </Link>
              </div>
              <h2 className="mt-4 text-base font-semibold">{report.title}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {report.metrics.map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-border bg-surface p-3">
                    <p className="num text-lg font-semibold">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHead title="Report sources" hint="These reports update with the same shared CRM data" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pipeline & Sales", "/sales", TrendingUp],
            ["Projects & Tasks", "/projects", FolderKanban],
            ["Activity log", "/activity", Activity],
            ["Documents", "/documents", FileText],
          ].map(([label, href, Icon]: any) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-raised">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
