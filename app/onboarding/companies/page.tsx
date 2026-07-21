"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Organisation } from "@/lib/types";

export default function CompaniesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      supabase
        .from("profiles")
        .select("organisation_id, registration_complete")
        .eq("user_id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.registration_complete) {
            router.push("/overview");
            return;
          }
          supabase
            .from("organisations")
            .select("*")
            .order("name", { ascending: true })
            .then(({ data: orgData }) => {
              if (orgData) setOrgs(orgData as Organisation[]);
              setOrgsLoading(false);
            });
        });
    });
  }, []);

  async function requestInvite(orgId: string) {
    setInviting(orgId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setInviting(null); router.push("/login"); return; }

    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email || "",
      role: "viewer",
      status: "active",
      organisation_id: orgId,
      registration_complete: true,
    });

    if (profileError) { setInviting(null); console.error(profileError.message); return; }

    sessionStorage.removeItem("signup_choice");
    sessionStorage.removeItem("signup_email");
    router.push("/profile");
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-crm-bg p-6 max-md:p-0 max-md:items-stretch overflow-y-auto">
      <div className="w-full max-w-[540px] rounded-[20px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,.08)] bg-crm-panel animate-[loginRise_0.45s_cubic-bezier(.16,1,.3,1)_both] p-[46px_40px] max-md:p-0 max-md:rounded-none max-md:shadow-none max-md:min-h-dvh max-md:overflow-auto">
        <div className="grid gap-[18px] max-md:p-[34px_26px]">
          <div className="flex items-center gap-[10px]">
            <div className="w-[42px] h-[42px] rounded-[9px] bg-[#202a36] grid place-items-center overflow-hidden shrink-0">
              <Image
                src="/supertelque-logo.png"
                alt="SuperTelque"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="m-0 text-[18px]">Choose your organisation</h1>
              <p className="m-[2px_0_0] text-crm-muted text-[12px]">
                Select the company you'd like to join
              </p>
            </div>
          </div>

          {orgsLoading ? (
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
                    onClick={() => requestInvite(org.id)} disabled={inviting !== null}
                    className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[34px] rounded-[6px] px-3 text-[12px] whitespace-nowrap hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inviting === org.id ? "Requesting..." : "Request invite"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes loginRise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
