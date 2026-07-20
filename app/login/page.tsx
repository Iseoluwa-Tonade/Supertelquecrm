"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter email and password");
      return;
    }
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push("/overview");
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first");
      return;
    }
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      setError(resetError.message);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-crm-bg p-6">
      <div className="w-full max-w-[940px] grid grid-cols-[1.05fr_1fr] max-md:grid-cols-1 rounded-[20px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,.08)] bg-crm-panel animate-[loginRise_0.45s_cubic-bezier(.16,1,.3,1)_both]">
        <div className="relative p-12 bg-gradient-to-br from-[#14b8a6] via-[#0f766e] to-[#0b3d3a] text-[#eafffa] overflow-hidden hidden md:flex items-center">
          <div className="absolute w-[260px] h-[260px] rounded-full bg-[#5eead4] top-[-70px] right-[-60px] opacity-55 blur-[46px] pointer-events-none" />
          <div className="absolute w-[220px] h-[220px] rounded-full bg-[#facc15] bottom-[-90px] left-[-50px] opacity-20 blur-[46px] pointer-events-none" />
          <div className="relative z-10 grid gap-[18px]">
            <span className="inline-flex items-center gap-2 uppercase tracking-[.14em] text-[11px] font-extrabold text-[#99f6e4]">
              SuperTelque CRM
            </span>
            <h2 className="m-0 text-[27px] leading-[1.28] tracking-[-0.01em]">
              One calm workspace for your whole client journey
            </h2>
            <p className="m-0 text-[14px] leading-[1.55] text-[rgba(234,255,250,.82)]">
              Pipeline, delivery, documents, and reporting — without switching
              tools.
            </p>
            <ul className="list-none m-[6px_0_0] p-0 grid gap-3">
              {[
                "Pipeline & project boards with drag-and-drop",
                "Role-based access for admins, managers, and reps",
                "Document upload with inline preview",
                "Admin pricing calculator for fast quotes",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-[11px] text-[13px] text-[rgba(234,255,250,.94)]"
                >
                  <span className="w-[22px] h-[22px] rounded-full bg-[rgba(255,255,255,.16)] grid place-items-center text-[11px] shrink-0">
                    &#10003;
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-[46px_40px] max-md:p-[34px_26px] flex items-center justify-center">
          <div className="w-full max-w-[340px] grid gap-[18px]">
            <div className="flex items-center gap-[10px]">
              <div className="w-[42px] h-[42px] rounded-[9px] bg-[#202a36] grid place-items-center overflow-hidden shrink-0">
                <img
                  src="/supertelque-logo.png"
                  alt="SuperTelque"
                  className="w-[36px] h-[36px] object-contain"
                />
              </div>
              <div>
                <h1 className="m-0 text-[18px]">SuperTelque CRM</h1>
                <p className="m-[2px_0_0] text-crm-muted text-[12px]">
                  Client journey, delivery, and documents in one workspace.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-[10px]">
              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Email
                <div className="relative">
                  <svg
                    className="absolute left-[11px] top-1/2 -translate-y-1/2 text-crm-muted pointer-events-none"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 6-10 7L2 6" />
                  </svg>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-[34px]"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                Password
                <div className="relative">
                  <svg
                    className="absolute left-[11px] top-1/2 -translate-y-1/2 text-crm-muted pointer-events-none"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-[34px]"
                    autoComplete="current-password"
                    required
                  />
                </div>
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
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="border-0 bg-transparent text-crm-muted min-h-auto p-0 text-left text-[12px] cursor-pointer hover:text-crm-accent-strong"
              >
                Forgot your password?
              </button>
            </form>

            <p className="text-crm-muted text-[12px] text-center leading-[1.5]">
              Access is invite-only. Your CRM data is protected by Supabase Auth
              and row-level security — only teammates invited by an admin can
              sign in.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes loginRise {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
