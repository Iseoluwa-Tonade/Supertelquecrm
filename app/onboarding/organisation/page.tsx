"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function OnboardOrganisationPage() {
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const email = sessionStorage.getItem("signup_email");
    if (email) setOrgEmail(email);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) {
      setError("Organisation name is required");
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

    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .insert({
        name: orgName.trim(),
        email: orgEmail.trim() || session.user.email,
        phone: orgPhone.trim(),
        address: orgAddress.trim(),
        website: orgWebsite.trim(),
      })
      .select()
      .single();

    if (orgError) {
      setError(orgError.message);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email || "",
      display_name: displayName.trim() || session.user.email?.split("@")[0] || "Admin",
      role: "admin",
      status: "active",
      organisation_id: org.id,
      registration_complete: true,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    sessionStorage.removeItem("signup_choice");
    sessionStorage.removeItem("signup_email");
    router.push("/overview");
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-crm-bg p-6 overflow-y-auto">
      <div className="w-full max-w-[520px] rounded-[20px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,.08)] bg-crm-panel animate-[loginRise_0.45s_cubic-bezier(.16,1,.3,1)_both]">
        <div className="p-[46px_40px] max-md:p-[34px_26px]">
          <div className="w-full grid gap-[18px]">
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
                <h1 className="m-0 text-[18px]">Set up your organisation</h1>
                <p className="m-[2px_0_0] text-crm-muted text-[12px]">
                  Fill in your company details to create your CRM workspace
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Organisation name *
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your Company Ltd"
                  required
                />
              </label>

              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Organisation email
                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  placeholder="company@example.com"
                />
              </label>

              <div className="grid grid-cols-2 gap-[10px]">
                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Phone
                  <input
                    value={orgPhone}
                    onChange={(e) => setOrgPhone(e.target.value)}
                    placeholder="+44 20 1234 5678"
                  />
                </label>
                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Website
                  <input
                    value={orgWebsite}
                    onChange={(e) => setOrgWebsite(e.target.value)}
                    placeholder="https://example.com"
                  />
                </label>
              </div>

              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Address
                <input
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  placeholder="123 High Street, London"
                />
              </label>

              <div className="border-t border-crm-line my-2" />

              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Your display name
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="John Doe"
                />
              </label>

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
                {loading ? "Creating..." : "Create organisation"}
              </button>
            </form>
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
