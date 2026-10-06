import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/mcp/crypto";
import { listRemoteTools } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  if (errorParam) {
    return NextResponse.redirect(`${origin}/connections?mcp=error&reason=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/connections?mcp=error&reason=missing_code`);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      const next = encodeURIComponent(`/api/mcp/oauth/callback?${url.searchParams.toString()}`);
      return NextResponse.redirect(`${origin}/login?next=${next}`);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation_id,role,status")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!profile?.organisation_id || profile.status !== "active" || !["admin","manager"].includes(profile.role)) {
      throw new Error("Insufficient permissions");
    }

    const { data: connection, error: connectionError } = await supabase
      .from("crm_mcp_connections")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .eq("oauth_state", state)
      .single();

    if (connectionError || !connection) throw new Error("MCP OAuth state is invalid or expired");
    if (!connection.token_endpoint || !connection.client_id) throw new Error("MCP OAuth client is incomplete");

    const verifier = await decryptSecret(connection.pkce_verifier_enc);
    if (!verifier) throw new Error("MCP OAuth PKCE verifier is missing");

    const clientSecret = await decryptSecret(connection.client_secret_enc);
    const redirectUri = `${origin}/api/mcp/oauth/callback`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      client_id: connection.client_id,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${connection.client_id}:${clientSecret}`).toString("base64")}`;
      body.delete("client_id");
    }

    const response = await fetch(connection.token_endpoint, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });

    const token = await response.json();
    if (!response.ok || !token.access_token) {
      throw new Error(token.error_description || token.error || "MCP OAuth token exchange failed");
    }

    const toolsResult = await listRemoteTools(connection.server_url, token.access_token);

    await supabase
      .from("crm_mcp_connections")
      .update({
        access_token_enc: await encryptSecret(token.access_token),
        refresh_token_enc: await encryptSecret(token.refresh_token || null),
        token_type: token.token_type || "Bearer",
        token_expires_at: token.expires_in
          ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
          : null,
        scope: token.scope || connection.scope,
        tools_cache: toolsResult.tools,
        status: "connected",
        last_connected_at: new Date().toISOString(),
        last_error: null,
        pkce_verifier_enc: null,
        oauth_state: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("organisation_id", profile.organisation_id);

    await supabase.from("crm_mcp_audit").insert({
      organisation_id: profile.organisation_id,
      user_id: userData.user.id,
      connection_id: connection.id,
      direction: "outbound",
      action: "oauth_connected",
      success: true,
      detail: { provider: connection.provider, tool_count: toolsResult.tools.length },
    });

    return NextResponse.redirect(`${origin}/connections?mcp=connected`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "oauth_failed";
    return NextResponse.redirect(`${origin}/connections?mcp=error&reason=${encodeURIComponent(reason)}`);
  }
}
