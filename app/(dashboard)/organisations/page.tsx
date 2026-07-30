"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { Organisation } from "@/lib/types";
import { Panel, PanelHead, PageHeader, Btn } from "@/components/kit.launchpad";

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
    <div className="space-y-6">
      <PageHeader variant="account"
        eyebrow="Account"
        title="Organisations"
        desc="Browse companies registered on SuperTelque CRM and request to join."
      />

      <Panel>
        <PanelHead title="Choose your organisation" />
        <div className="p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Select the company you'd like to join. Your request will be sent to the admin for approval.
          </p>

          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading organisations...</p>
          ) : orgs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No organisations registered yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {orgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{org.name}</p>
                    {org.email && <p className="text-xs text-muted-foreground">{org.email}</p>}
                  </div>
                  <Btn size="sm" variant="primary" onClick={() => requestJoin(org.id)} disabled={requesting !== null}>
                    {requesting === org.id ? "Sending request..." : "Request to join"}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
