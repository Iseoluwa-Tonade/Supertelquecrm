import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getConnectionAccessToken, type McpConnectionRow } from "@/lib/mcp/connections";
import { callRemoteTool, listRemoteTools } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getContext(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organisation_id,role,status")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile?.organisation_id || profile.status !== "active" || !["admin","manager"].includes(profile.role)) {
    throw new Error("Insufficient permissions");
  }

  const { data: connection, error } = await supabase
    .from("crm_mcp_connections")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", profile.organisation_id)
    .single();

  if (error || !connection) throw new Error("MCP connection not found");
  return { supabase, user: userData.user, profile, connection: connection as McpConnectionRow & Record<string, any> };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, profile, user, connection } = await getContext(id);
    const token = await getConnectionAccessToken(supabase, connection);
    const listed = await listRemoteTools(connection.server_url, token);

    await supabase.from("crm_mcp_connections").update({
      tools_cache: listed.tools,
      status: "connected",
      last_connected_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id).eq("organisation_id", profile.organisation_id);

    await supabase.from("crm_mcp_audit").insert({
      organisation_id: profile.organisation_id,
      user_id: user.id,
      connection_id: connection.id,
      direction: "outbound",
      action: "tools/list",
      success: true,
      detail: { tool_count: listed.tools.length },
    });

    return NextResponse.json({ tools: listed.tools });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not list tools" }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const toolName = String(body.tool_name || "");
    const args = (body.arguments || {}) as Record<string, unknown>;
    if (!toolName) return NextResponse.json({ error: "tool_name is required" }, { status: 400 });

    const { supabase, profile, user, connection } = await getContext(id);
    const token = await getConnectionAccessToken(supabase, connection);
    const result = await callRemoteTool(connection.server_url, toolName, args, token);

    await supabase.from("crm_mcp_audit").insert({
      organisation_id: profile.organisation_id,
      user_id: user.id,
      connection_id: connection.id,
      direction: "outbound",
      tool_name: toolName,
      action: "tools/call",
      success: true,
      detail: {},
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "MCP tool call failed" }, { status: 400 });
  }
}
