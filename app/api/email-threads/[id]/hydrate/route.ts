import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/mcp/crypto";
import { callRemoteTool, listRemoteTools } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RemoteTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
};

function normalize(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findTool(tools: RemoteTool[], needles: string[]) {
  return tools.find((tool) => {
    const haystack = normalize([tool.name, tool.title, tool.description].filter(Boolean).join(" "));
    return needles.some((needle) => haystack.includes(normalize(needle)));
  }) || null;
}

function unwrap(value: any): any {
  if (value == null) return value;
  if (value.structuredContent != null) return unwrap(value.structuredContent);
  if (Array.isArray(value.content)) {
    for (const part of value.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        try { return unwrap(JSON.parse(part.text)); } catch {}
      }
    }
  }
  if (value.data != null) return unwrap(value.data);
  return value;
}

function buildArgs(tool: RemoteTool, pathVariables: Record<string, unknown>, queryParams: Record<string, unknown>) {
  const props = tool.inputSchema?.properties || {};
  const args: Record<string, unknown> = {};
  if ("path_variables" in props) args.path_variables = pathVariables;
  else Object.assign(args, pathVariables);
  if ("query_params" in props) args.query_params = queryParams;
  else Object.assign(args, queryParams);
  return args;
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function resolveAccessToken(connection: any, supabase: any) {
  if (connection.auth_type === "none") return null;
  let accessToken = await decryptSecret(connection.access_token_enc);
  if (!accessToken) throw new Error("Zoho MCP is not authorized. Reconnect it from Connections.");

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (connection.auth_type !== "oauth" || !expiresAt || expiresAt > Date.now() + 90_000) return accessToken;

  const refreshToken = await decryptSecret(connection.refresh_token_enc);
  if (!refreshToken || !connection.token_endpoint || !connection.client_id) {
    throw new Error("Zoho MCP authorization expired. Reconnect it from Connections.");
  }

  const clientSecret = await decryptSecret(connection.client_secret_enc);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: connection.client_id,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${connection.client_id}:${clientSecret}`).toString("base64")}`;
    body.delete("client_id");
  }

  const response = await fetch(connection.token_endpoint, { method: "POST", headers, body, cache: "no-store" });
  const token = await response.json();
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Could not refresh Zoho MCP authorization.");
  }

  accessToken = token.access_token;
  await supabase.from("crm_mcp_connections").update({
    access_token_enc: await encryptSecret(accessToken),
    refresh_token_enc: await encryptSecret(token.refresh_token || refreshToken),
    token_type: token.token_type || connection.token_type || "Bearer",
    token_expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
    scope: token.scope || connection.scope,
    status: "connected",
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);

  return accessToken;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation_id,status")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!profile?.organisation_id || profile.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: messages, error: messageError } = await supabase
      .from("crm_emails")
      .select("id,provider_account_id,folder_id,provider_message_id,body_text")
      .eq("organisation_id", profile.organisation_id)
      .eq("thread_id", id)
      .eq("provider", "zoho")
      .order("created_at", { ascending: true });

    if (messageError) throw messageError;

    const missing = (messages || []).filter((row: any) => !row.body_text && row.provider_account_id && row.folder_id && row.provider_message_id);
    if (!missing.length) return NextResponse.json({ hydrated: 0 });

    const accountIds = [...new Set(missing.map((row: any) => String(row.provider_account_id)))];
    const { data: accounts, error: accountError } = await supabase
      .from("crm_email_accounts")
      .select("provider_account_id,mcp_connection_id")
      .eq("organisation_id", profile.organisation_id)
      .eq("provider", "zoho")
      .in("provider_account_id", accountIds);
    if (accountError) throw accountError;

    const connectionIds = [...new Set((accounts || []).map((row: any) => row.mcp_connection_id).filter(Boolean))];
    if (!connectionIds.length) return NextResponse.json({ error: "No Zoho MCP connection is linked to this mailbox." }, { status: 400 });

    let hydrated = 0;

    for (const connectionId of connectionIds) {
      const { data: connection, error: connectionError } = await supabase
        .from("crm_mcp_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("organisation_id", profile.organisation_id)
        .eq("provider", "zoho")
        .maybeSingle();
      if (connectionError || !connection) continue;

      const accessToken = await resolveAccessToken(connection, supabase);
      let tools = Array.isArray(connection.tools_cache) ? connection.tools_cache as RemoteTool[] : [];
      if (!tools.length) {
        const listed = await listRemoteTools(connection.server_url, accessToken);
        tools = listed.tools as RemoteTool[];
      }
      const contentTool = findTool(tools, ["getMessageContent", "message content"]);
      if (!contentTool) continue;

      const linkedAccounts = new Set(
        (accounts || [])
          .filter((row: any) => row.mcp_connection_id === connectionId)
          .map((row: any) => String(row.provider_account_id)),
      );

      for (const row of missing.filter((item: any) => linkedAccounts.has(String(item.provider_account_id))).slice(0, 100)) {
        try {
          const result = await callRemoteTool(
            connection.server_url,
            contentTool.name,
            buildArgs(
              contentTool,
              {
                accountId: String(row.provider_account_id),
                folderId: String(row.folder_id),
                messageId: String(row.provider_message_id),
              },
              { includeBlockContent: true },
            ),
            accessToken,
          );
          const data = unwrap(result);
          const html = typeof data?.content === "string" ? data.content : null;
          if (!html) continue;
          const text = stripHtml(html);
          const { error } = await supabase
            .from("crm_emails")
            .update({
              body_html: html,
              body_text: text,
              summary: text.slice(0, 350),
            })
            .eq("id", row.id)
            .eq("organisation_id", profile.organisation_id);
          if (!error) hydrated += 1;
        } catch {}
      }
    }

    return NextResponse.json({ hydrated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load full email content" },
      { status: 500 },
    );
  }
}
