import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/mcp/crypto";

export type McpConnectionRow = {
  id: string;
  organisation_id: string;
  name: string;
  provider: string;
  server_url: string;
  auth_type: "oauth" | "bearer" | "none";
  status: string;
  token_endpoint: string | null;
  client_id: string | null;
  client_secret_enc: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  scope: string | null;
};

export async function getConnectionAccessToken(
  supabase: SupabaseClient,
  connection: McpConnectionRow,
) {
  if (connection.auth_type === "none") return null;

  let accessToken = await decryptSecret(connection.access_token_enc);
  if (connection.auth_type === "bearer") return accessToken;
  if (!accessToken) throw new Error("MCP connection is not authorized");

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  const shouldRefresh = expiresAt > 0 && expiresAt < Date.now() + 60_000;
  if (!shouldRefresh) return accessToken;

  const refreshToken = await decryptSecret(connection.refresh_token_enc);
  if (!refreshToken || !connection.token_endpoint || !connection.client_id) {
    throw new Error("MCP OAuth token expired and cannot be refreshed");
  }

  const clientSecret = await decryptSecret(connection.client_secret_enc);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
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
    throw new Error(token.error_description || token.error || "MCP OAuth refresh failed");
  }

  accessToken = token.access_token;
  await supabase
    .from("crm_mcp_connections")
    .update({
      access_token_enc: await encryptSecret(token.access_token),
      refresh_token_enc: await encryptSecret(token.refresh_token || refreshToken),
      token_type: token.token_type || "Bearer",
      token_expires_at: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
      scope: token.scope || connection.scope,
      status: "connected",
      last_connected_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .eq("organisation_id", connection.organisation_id);

  return accessToken;
}
