"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function OnboardProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const orgId = sessionStorage.getItem("selected_org_id");
    if (!orgId) {
      router.push("/onboarding/companies");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const orgId = sessionStorage.getItem("selected_org_id");
    if (!orgId) {
      setError("No organisation selected. Go back and choose one.");
      return;
    }
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email || "",
      display_name: displayName.trim() || session.user.email?.split("@")[0] || "User",
      role: "viewer",
      status: "active",
      organisation_id: orgId,
      registration_complete: true,
      job_title: jobTitle.trim(),
      phone: phone.trim(),
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const { error: inviteError } = await supabase.from("invite_requests").insert({
      user_id: session.user.id,
      organisation_id: orgId,
      status: "pending",
    });

    if (inviteError) {
      setError(inviteError.message);
      setLoading(false);
      return;
    }

    sessionStorage.removeItem("selected_org_id");
    sessionStorage.removeItem("signup_choice");
    sessionStorage.removeItem("signup_email");
    router.push("/onboarding/invite-sent");
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-crm-bg p-6 overflow-y-auto">
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
              <h1 className="m-0 text-[18px]">Complete your profile</h1>
              <p className="m-[2px_0_0] text-crm-muted text-[12px]">
                Fill in your details to request an invite
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-[10px]">
            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Display name *
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Job title
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Software Engineer"
                />
              </label>
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Phone
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+44 20 1234 5678"
                />
              </label>
            </div>

            {error && (
              <div className="border border-[#fecdd3] bg-[#fff1f2] text-crm-rose rounded-[7px] p-[8px_10px] text-[12px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[38px] rounded-[6px] hover:brightness-105 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,118,110,.28)] active:translate-y-0 active:shadow-none disabled:bg-crm-panel-strong disabled:text-crm-muted disabled:border-crm-line disabled:brightness-100 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Complete registration"}
            </button>
          </form>
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
