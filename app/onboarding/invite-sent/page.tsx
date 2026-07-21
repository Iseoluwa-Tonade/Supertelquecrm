"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InviteSentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: invite } = await supabase
        .from("invite_requests")
        .select("status")
        .eq("user_id", session.user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (invite) {
        router.push("/overview");
        return;
      }

      setChecking(false);
    };

    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-crm-bg p-6">
      <div className="w-full max-w-[440px] rounded-[20px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,.08)] bg-crm-panel animate-[loginRise_0.45s_cubic-bezier(.16,1,.3,1)_both] p-[46px_40px] max-md:p-[34px_26px] text-center">
        <div className="grid gap-[18px] place-items-center">
          <div className="w-[64px] h-[64px] rounded-full bg-gradient-to-br from-[#6366f1] to-[#4f46e5] grid place-items-center text-white text-2xl">
            &#9993;
          </div>
          <h1 className="m-0 text-[20px]">Request sent</h1>
          <p className="m-0 text-crm-muted text-[13px] leading-[1.5]">
            Your request to join the organisation has been sent to the admin.
            You will be notified once your membership is approved.
          </p>
          <p className="m-0 text-crm-muted text-[12px] leading-[1.5]">
            Meanwhile, you can{" "}
            <a href="/onboarding/profile" className="text-crm-accent-strong hover:underline">
              update your profile
            </a>
            .
          </p>
          {!checking && (
            <button
              onClick={() => router.push("/login")}
              className="border-0 bg-transparent text-crm-muted text-[12px] cursor-pointer hover:text-crm-accent-strong"
            >
              Sign out
            </button>
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
