"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppProvider, useApp } from "@/lib/AppContext";
import { ToastProvider } from "@/components/Toast";
import DetailPanel from "@/components/DetailPanel";
import { AppShellLaunchpad } from "@/components/AppShell.launchpad";
import { canSeeView } from "@/lib/access";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, organisation, selectedId } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const currentView = pathname.split("/").filter(Boolean)[0] || "overview";
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || !profile) return;

    if (!profile.registration_complete) {
      if (currentView !== "profile" && currentView !== "organisations") {
        router.push("/profile");
      }
      return;
    }

    if (profile.role !== "admin") {
      supabase
        .from("invite_requests")
        .select("status")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setInviteStatus(data.status);
        });
    }
  }, [session, profile, currentView, router]);

  useEffect(() => {
    if (inviteStatus === "pending" && currentView !== "profile") {
      router.push("/profile");
    }
  }, [inviteStatus, currentView, router]);

  useEffect(() => {
    if (!session || !profile) return;
    if (!profile.registration_complete) return;

    if (currentView !== "overview" && !canSeeView(profile, organisation, currentView)) {
      router.replace("/overview");
    }
  }, [session, profile, organisation, currentView, router]);

  if (loading) {
    return (
      <div className="h-dvh flex flex-col items-center bg-background text-muted-foreground p-6 overflow-y-auto">
        <div className="flex-1 shrink" />
        <span className="shrink-0">Loading the CRM database...</span>
        <div className="flex-1 shrink" />
      </div>
    );
  }

  if (!session) return null;

  if (inviteStatus === "pending" && currentView !== "profile") {
    return null;
  }

  return (
    <>
      <AppShellLaunchpad>{children}</AppShellLaunchpad>
      {selectedId ? <DetailPanel /> : null}
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ToastProvider>
        <DashboardInner>{children}</DashboardInner>
      </ToastProvider>
    </AppProvider>
  );
}
