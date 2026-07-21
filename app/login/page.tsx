"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "choose";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signupChoice, setSignupChoice] = useState<"org" | "team" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignIn(e: FormEvent) {
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
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organisation_id, registration_complete")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.registration_complete) {
        router.push("/overview");
      } else {
        router.push("/onboarding/companies");
      }
    } else {
      router.push("/overview");
    }
    setLoading(false);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (!email || !password || !signupChoice) {
      setError("Fill in all fields and choose an option");
      return;
    }
    setLoading(true);
    setError("");
    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data?.user?.identities?.length === 0) {
      setError("An account with this email already exists. Sign in instead.");
      return;
    }
    sessionStorage.setItem("signup_choice", signupChoice);
    sessionStorage.setItem("signup_email", email);
    router.push(signupChoice === "org" ? "/onboarding/organisation" : "/onboarding/companies");
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

  async function handleGoogleOAuth() {
    setOauthLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setSignupChoice(null);
  }

  const isSignUp = mode === "signup" || mode === "choose";

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
                <Image
                  src="/supertelque-logo.png"
                  alt="SuperTelque"
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="m-0 text-[18px]">SuperTelque CRM</h1>
                <p className="m-[2px_0_0] text-crm-muted text-[12px]">
                  Client journey, delivery, and documents in one workspace.
                </p>
              </div>
            </div>

            {mode === "signin" ? (
              <form onSubmit={handleSignIn} className="grid gap-[10px]">
                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Email
                  <div className="relative">
                    <svg
                      className="absolute left-[11px] top-1/2 -translate-y-1/2 text-crm-muted pointer-events-none"
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 6-10 7L2 6" />
                    </svg>
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="pl-[34px]" autoComplete="email" required
                    />
                  </div>
                </label>

                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Password
                  <div className="relative">
                    <svg
                      className="absolute left-[11px] top-1/2 -translate-y-1/2 text-crm-muted pointer-events-none"
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-[34px] pr-[34px]" autoComplete="current-password" required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-[8px] top-1/2 -translate-y-1/2 w-[26px] h-[26px] p-0 grid place-items-center border-0 bg-transparent text-crm-muted cursor-pointer hover:text-crm-accent-strong"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>

                {error && (
                  <div className="border border-[#fecdd3] bg-[#fff1f2] text-crm-rose rounded-[7px] p-[8px_10px] text-[12px]">
                    {error}
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[38px] rounded-[6px] hover:brightness-105 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,118,110,.28)] active:translate-y-0 active:shadow-none disabled:bg-crm-panel-strong disabled:text-crm-muted disabled:border-crm-line disabled:brightness-100 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>

                <button
                  type="button" onClick={handleForgotPassword}
                  className="border-0 bg-transparent text-crm-muted min-h-auto p-0 text-left text-[12px] cursor-pointer hover:text-crm-accent-strong"
                >
                  Forgot your password?
                </button>

                <div className="flex items-center gap-3 before:flex-1 before:h-px before:bg-crm-line after:flex-1 after:h-px after:bg-crm-line text-crm-muted text-[11px] font-medium">
                  or
                </div>

                <button
                  type="button" onClick={handleGoogleOAuth} disabled={oauthLoading}
                  className="flex items-center justify-center gap-[10px] w-full min-h-[38px] rounded-[6px] border border-crm-line bg-crm-panel text-crm-text font-medium text-[13px] cursor-pointer hover:bg-crm-panel-strong hover:border-crm-line-strong disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {oauthLoading ? "Redirecting..." : "Sign in with Google"}
                </button>
              </form>
            ) : mode === "choose" ? (
              <div className="grid gap-3">
                <p className="m-0 text-crm-muted text-[12px]">Choose how you want to get started</p>
                <button
                  onClick={() => { setSignupChoice("org"); setMode("signup"); }}
                  className="flex items-center gap-3 p-4 rounded-[10px] border border-crm-line bg-crm-panel text-left hover:bg-crm-accent/5 hover:border-crm-accent transition-all"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#14b8a6] to-[#0f766e] grid place-items-center text-white text-lg shrink-0">+</div>
                  <div>
                    <strong className="block text-[14px]">Create an organisation</strong>
                    <span className="text-crm-muted text-[12px]">Set up a new CRM workspace for your company</span>
                  </div>
                </button>
                <button
                  onClick={() => { setSignupChoice("team"); setMode("signup"); }}
                  className="flex items-center gap-3 p-4 rounded-[10px] border border-crm-line bg-crm-panel text-left hover:bg-crm-accent/5 hover:border-crm-accent transition-all"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#6366f1] to-[#4f46e5] grid place-items-center text-white text-lg shrink-0">&#9997;</div>
                  <div>
                    <strong className="block text-[14px]">Join as team member</strong>
                    <span className="text-crm-muted text-[12px]">Request to join an existing organisation</span>
                  </div>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignUp} className="grid gap-[10px]">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button" onClick={() => switchMode("choose")}
                    className="text-crm-muted hover:text-crm-text text-[12px] border-0 bg-transparent cursor-pointer p-0"
                  >
                    &#8592; Back
                  </button>
                  <span className="text-crm-muted text-[12px]">
                    {signupChoice === "org" ? "Creating an organisation" : "Joining as team member"}
                  </span>
                </div>

                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>

                <label className="grid gap-[5px] text-crm-muted text-[12px] font-semibold">
                  Password
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={6} />
                </label>

                {error && (
                  <div className="border border-[#fecdd3] bg-[#fff1f2] text-crm-rose rounded-[7px] p-[8px_10px] text-[12px]">
                    {error}
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[38px] rounded-[6px] hover:brightness-105 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,118,110,.28)] active:translate-y-0 active:shadow-none disabled:bg-crm-panel-strong disabled:text-crm-muted disabled:border-crm-line disabled:brightness-100 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>

                <div className="flex items-center gap-3 before:flex-1 before:h-px before:bg-crm-line after:flex-1 after:h-px after:bg-crm-line text-crm-muted text-[11px] font-medium">
                  or
                </div>

                <button
                  type="button" onClick={handleGoogleOAuth} disabled={oauthLoading}
                  className="flex items-center justify-center gap-[10px] w-full min-h-[38px] rounded-[6px] border border-crm-line bg-crm-panel text-crm-text font-medium text-[13px] cursor-pointer hover:bg-crm-panel-strong hover:border-crm-line-strong disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {oauthLoading ? "Redirecting..." : "Sign up with Google"}
                </button>
              </form>
            )}

            <p className="text-crm-muted text-[12px] text-center leading-[1.5]">
              {isSignUp
                ? <>Already have an account?{" "}<button onClick={() => switchMode("signin")} className="text-crm-accent-strong hover:underline border-0 bg-transparent cursor-pointer p-0 text-[12px] font-inherit">Sign in</button></>
                : <>Don't have an account?{" "}<button onClick={() => switchMode("choose")} className="text-crm-accent-strong hover:underline border-0 bg-transparent cursor-pointer p-0 text-[12px] font-inherit">Create one</button></>
              }
            </p>

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
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
