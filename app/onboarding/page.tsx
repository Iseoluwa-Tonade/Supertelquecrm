"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);

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
          setChecking(false);
        });
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-crm-bg text-crm-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-crm-bg p-6">
      <div className="w-full max-w-[480px] rounded-[20px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,.08)] bg-crm-panel animate-[loginRise_0.45s_cubic-bezier(.16,1,.3,1)_both] p-[46px_40px] max-md:p-[34px_26px]">
        <div className="grid gap-[18px]">
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
              <h1 className="m-0 text-[18px]">Welcome to SuperTelque</h1>
              <p className="m-[2px_0_0] text-crm-muted text-[12px]">
                You're signed in. Choose how to get started.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              onClick={() => router.push("/onboarding/organisation")}
              className="flex items-center gap-3 p-4 rounded-[10px] border border-crm-line bg-crm-panel text-left hover:bg-crm-accent/5 hover:border-crm-accent transition-all"
            >
              <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#14b8a6] to-[#0f766e] grid place-items-center text-white text-lg shrink-0">+</div>
              <div>
                <strong className="block text-[14px]">Create an organisation</strong>
                <span className="text-crm-muted text-[12px]">Set up a new CRM workspace for your company</span>
              </div>
            </button>
            <button
              onClick={() => router.push("/onboarding/join")}
              className="flex items-center gap-3 p-4 rounded-[10px] border border-crm-line bg-crm-panel text-left hover:bg-crm-accent/5 hover:border-crm-accent transition-all"
            >
              <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#6366f1] to-[#4f46e5] grid place-items-center text-white text-lg shrink-0">&#9997;</div>
              <div>
                <strong className="block text-[14px]">Join as team member</strong>
                <span className="text-crm-muted text-[12px]">Request to join an existing organisation</span>
              </div>
            </button>
          </div>
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
