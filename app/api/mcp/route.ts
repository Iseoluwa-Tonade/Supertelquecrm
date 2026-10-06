import { NextRequest, NextResponse } from "next/server";
import { CRM_MCP_TOOLS, authenticateMcpBearer, executeCrmTool } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function unauthorized(request: NextRequest) {
  const origin = new URL(request.url).origin;
  return new NextResponse(JSON.stringify({ error: "authorization_required" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return unauthorized(request);

  let session;
  try {
    session = await authenticateMcpBearer(token);
  } catch {
    return unauthorized(request);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const id = body?.id;
  const method = body?.method;

  if (method === "initialize") {
    const requested = body?.params?.protocolVersion;
    const supported = new Set(["2026-07-28", "2025-06-18", "2025-03-26"]);
    return rpcResult(id, {
      protocolVersion: supported.has(requested) ? requested : "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "Supertelque CRM", version: "1.0.0" },
      instructions: "Use these tools to read and update the authenticated user's Supertelque CRM workspace. Treat create_task and update_pipeline_item as write actions.",
    });
  }

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 204 });
  }

  if (method === "ping") return rpcResult(id, {});

  if (method === "tools/list") {
    return rpcResult(id, { tools: CRM_MCP_TOOLS });
  }

  if (method === "tools/call") {
    const toolName = body?.params?.name;
    const args = body?.params?.arguments || {};
    if (!toolName) return rpcError(id, -32602, "Tool name is required");

    try {
      const result = await executeCrmTool(
        session.supabase,
        session.user.id,
        session.profile.organisation_id,
        toolName,
        args,
      );

      await session.supabase.from("crm_mcp_audit").insert({
        organisation_id: session.profile.organisation_id,
        user_id: session.user.id,
        direction: "inbound",
        tool_name: toolName,
        action: "tools/call",
        success: true,
        detail: { client: "remote_mcp" },
      });

      return rpcResult(id, result);
    } catch (error) {
      try {
        await session.supabase.from("crm_mcp_audit").insert({
          organisation_id: session.profile.organisation_id,
          user_id: session.user.id,
          direction: "inbound",
          tool_name: toolName,
          action: "tools/call",
          success: false,
          detail: { error: error instanceof Error ? error.message : "Unknown error" },
        });
      } catch {
        // Preserve the MCP error even if audit logging fails.
      }
      return rpcError(id, -32000, error instanceof Error ? error.message : "Tool call failed");
    }
  }

  return rpcError(id, -32601, `Method not found: ${String(method)}`);
}

export async function GET() {
  return NextResponse.json({
    name: "Supertelque CRM MCP",
    transport: "streamable-http",
    endpoint: "/api/mcp",
  });
}
