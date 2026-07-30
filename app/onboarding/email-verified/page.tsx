"use client";

import { useRouter } from "next/navigation";

export default function EmailVerifiedPage() {
  const router = useRouter();

  return (
    <div className="h-dvh flex flex-col items-center bg-crm-bg p-6 overflow-y-auto">
      <div className="flex-1 shrink" />
      <div className="w-full max-w-[400px] rounded-[20px] overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,.08)] bg-crm-panel animate-[loginRise_0.45s_cubic-bezier(.16,1,.3,1)_both] shrink-0">
        <div className="p-[46px_40px] max-md:p-[34px_26px] flex items-center justify-center">
          <div className="w-full grid gap-[18px] text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" className="text-emerald-600">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div>
              <h1 className="text-[20px] font-semibold text-crm-text m-0">Email verified</h1>
              <p className="text-crm-muted text-[13px] mt-1 leading-[1.5] m-0">
                Your email has been confirmed. You&apos;re one step away from getting started.
              </p>
            </div>

            <button
              onClick={() => router.push("/profile")}
              className="bg-gradient-to-r from-crm-accent to-crm-accent-strong text-white font-semibold border-transparent min-h-[42px] rounded-[8px] text-[14px] hover:brightness-105 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,118,110,.28)] active:translate-y-0 active:shadow-none cursor-pointer mt-2"
            >
              Proceed to profile setup
            </button>
          </div>
        </div>
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
