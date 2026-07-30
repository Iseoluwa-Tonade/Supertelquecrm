"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  return (
    <div className="h-dvh flex flex-col items-center bg-crm-bg p-6 overflow-y-auto">
      <div className="flex-1 shrink" />
      <div className="w-full max-w-[420px] rounded-[20px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,.08)] bg-crm-panel animate-[loginRise_0.45s_cubic-bezier(.16,1,.3,1)_both] p-[46px_40px] max-md:p-[34px_26px] shrink-0">
        {done ? (
          <div className="grid gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-crm-green/10 grid place-items-center mx-auto text-crm-green text-2xl">&#10003;</div>
            <h2 className="m-0 text-[18px]">Password updated</h2>
            <p className="m-0 text-crm-muted text-[13px]">Your password has been reset successfully. Redirecting to sign in...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="grid gap-[10px]">
            <h2 className="m-0 text-[18px]">Set new password</h2>
            <p className="m-0 text-crm-muted text-[12px]">Enter your new password below.</p>

            {error && (
              <div className="border border-[#fecdd3] bg-[#fff1f2] text-crm-rose rounded-[7px] p-[8px_10px] text-[12px]">{error}</div>
            )}

            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              New password
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password" required minLength={6}
                className="h-10 w-full rounded-md border border-crm-line bg-crm-panel px-3 text-sm text-crm-text outline-none transition-colors focus:border-crm-accent focus:shadow-[0_0_0_3px_rgba(15,118,110,.15)]"
              />
            </label>

            <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
              Confirm new password
              <input
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password" required minLength={6}
                className="h-10 w-full rounded-md border border-crm-line bg-crm-panel px-3 text-sm text-crm-text outline-none transition-colors focus:border-crm-accent focus:shadow-[0_0_0_3px_rgba(15,118,110,.15)]"
              />
            </label>

            <button
              type="submit" disabled={loading}
              className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[38px] rounded-[6px] hover:brightness-105 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,118,110,.28)] active:translate-y-0 active:shadow-none disabled:bg-crm-panel-strong disabled:text-crm-muted disabled:border-crm-line disabled:brightness-100 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
      <div className="flex-1 shrink" />

      <style jsx>{`
        @keyframes loginRise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
