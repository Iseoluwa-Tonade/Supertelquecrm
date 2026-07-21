"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { Organisation } from "@/lib/types";

const supabase = createClient();

export default function OrganisationsPage() {
  const router = useRouter();
  const { session, profile } = useApp();
  const { flash } = useToast();
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (!session) { router.push("/login"); return; }
    supabase
      .from("organisations")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setOrgs(data as Organisation[]);
        setLoading(false);
      });
  }, [session, router]);

  async function requestJoin(orgId: string) {
    setRequesting(orgId);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ organisation_id: orgId, registration_complete: true })
      .eq("user_id", session!.user.id);

    if (profileError) { flash(profileError.message); setRequesting(null); return; }

    const { error: inviteError } = await supabase.from("invite_requests").upsert({
      user_id: session!.user.id,
      organisation_id: orgId,
      status: "pending",
    }, { onConflict: "user_id,organisation_id" });

    setRequesting(null);
    if (inviteError) { flash(inviteError.message); return; }

    flash("Invite request sent! Waiting for admin approval.");
    router.push("/profile");
  }

  return (
    <div className="board-scroll overflow-auto min-h-0">
      <section className="overview p-[16px_18px] overflow-auto grid gap-[14px] content-start animate-[fadeInUp_0.3s_ease_both]">
        <div className="bg-crm-panel border border-crm-line rounded-[var(--radius,8px)] p-[14px] grid gap-3 content-start">
          <h2 className="m-0 text-[15px]">Choose your organisation</h2>
          <p className="text-crm-muted text-[13px] m-0">
            Select the company you'd like to join. Your request will be sent to the admin for approval.
          </p>

          {loading ? (
            <div className="text-crm-muted text-[13px] py-4 text-center">Loading organisations...</div>
          ) : orgs.length === 0 ? (
            <div className="text-crm-muted text-[13px] py-4 text-center">No organisations registered yet.</div>
          ) : (
            <div className="grid gap-2">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-[10px] border border-crm-line bg-crm-panel"
                >
                  <div>
                    <strong className="block text-[14px]">{org.name}</strong>
                    {org.email && <span className="text-crm-muted text-[12px]">{org.email}</span>}
                  </div>
                  <button
                    onClick={() => requestJoin(org.id)} disabled={requesting !== null}
                    className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3 text-[12px] whitespace-nowrap hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {requesting === org.id ? "Sending request..." : "Request to join"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
