"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ConsentDetails = {
  authorization_id?: string;
  redirect_url?: string;
  client?: { name?: string; client_name?: string };
  client_name?: string;
  scope?: string;
};

export default function OAuthConsentPage() {
  const searchParams = useSearchParams();
  const authorizationId = searchParams.get("authorization_id");
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!authorizationId) {
      setError("Missing authorization request.");
      return;
    }

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const next = encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`);
        window.location.href = `/login?next=${next}`;
        return;
      }

      const oauth = (supabase.auth as any).oauth;
      if (!oauth?.getAuthorizationDetails) {
        setError("OAuth consent is not available in the current Supabase client.");
        return;
      }

      const { data, error: authError } = await oauth.getAuthorizationDetails(authorizationId);
      if (authError) {
        setError(authError.message || "Could not load authorization request.");
        return;
      }

      if (data?.redirect_url && !data?.authorization_id) {
        window.location.replace(data.redirect_url);
        return;
      }

      setDetails(data || null);
    })();
  }, [authorizationId]);

  async function decide(approve: boolean) {
    if (!authorizationId) return;
    setWorking(true);
    setError("");
    try {
      const oauth = (supabase.auth as any).oauth;
      const fn = approve ? oauth?.approveAuthorization : oauth?.denyAuthorization;
      if (!fn) throw new Error("OAuth authorization API is unavailable.");
      const { data, error: authError } = await fn.call(oauth, authorizationId);
      if (authError) throw authError;
      if (!data?.redirect_url) throw new Error("OAuth server did not return a redirect URL.");
      window.location.replace(data.redirect_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed.");
      setWorking(false);
    }
  }

  const clientName =
    details?.client?.name ||
    details?.client?.client_name ||
    details?.client_name ||
    "An MCP client";

  const scopes = (details?.scope || "profile email").split(/\s+/).filter(Boolean);

  return (
    <div className="min-h-dvh bg-crm-bg p-6 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl border border-crm-line bg-crm-panel p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-crm-accent-strong">Supertelque CRM</p>
        <h1 className="mt-2 text-2xl font-semibold">Authorize MCP access</h1>
        <p className="mt-2 text-sm text-crm-muted">
          <strong>{clientName}</strong> wants to connect to your CRM as your signed-in user.
          Your existing CRM role and row-level permissions will still apply.
        </p>

        <div className="mt-5 rounded-xl border border-crm-line bg-crm-panel-strong p-4">
          <p className="text-xs font-semibold text-crm-muted">Requested scopes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scopes.map((scope) => (
              <span key={scope} className="rounded-full border border-crm-line bg-crm-panel px-2.5 py-1 text-xs">
                {scope}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          MCP clients may call CRM tools. Write tools such as creating tasks or updating pipeline records can change live CRM data.
        </div>

        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            disabled={working}
            className="rounded-lg border border-crm-line px-4 py-2 text-sm font-medium hover:bg-crm-panel-strong disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            disabled={working || !details}
            className="rounded-lg bg-crm-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
          >
            {working ? "Authorizing..." : "Allow"}
          </button>
        </div>
      </div>
    </div>
  );
}
