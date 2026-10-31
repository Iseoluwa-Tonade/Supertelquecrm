"use client";
import Link from "next/link";
import { useApp } from "@/lib/AppContext";
import { canSeeView } from "@/lib/access";
export function TaskViews({ active }: { active: "team" | "mine" }) {
  const { profile, organisation } = useApp();
  return <nav aria-label="Task views" className="flex gap-2">
    {([{id: "tasks", href: "/tasks", label: "Team tasks", value: "team"}, {id: "my-tasks", href: "/my-tasks", label: "My tasks", value: "mine"}] as const).filter(tab => canSeeView(profile, organisation, tab.id)).map(tab => <Link key={tab.id} href={tab.href} aria-current={active === tab.value ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-medium ${active === tab.value ? "bg-primary text-primary-foreground" : "bg-surface-raised text-muted-foreground"}`}>{tab.label}</Link>)}
  </nav>;
}
