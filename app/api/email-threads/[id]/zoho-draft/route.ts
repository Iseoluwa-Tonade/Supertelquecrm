import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { callRemoteTool, listRemoteTools } from "@/lib/mcp/client";
import { getConnectionAccessToken } from "@/lib/mcp/connections";

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

function findTool(tools: RemoteTool[], exact: string, phrases: string[]) {
  return tools.find((tool) => tool.name === exact) || tools.find((tool) => {
    const haystack = normalize([tool.name, tool.title, tool.description].filter(Boolean).join(" "));
    return phrases.some((phrase) => haystack.includes(normalize(phrase)));
  }) || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation_id,role,status")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!profile?.organisation_id || profile.status !== "active" || !["admin","manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Email draft access requires Admin or Manager permission." }, { status: 403 });
    }

    const body = await request.json();
    const toAddress = String(body.to || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    const content = String(body.content || "").replace(/[—–]/g, "-").replace(/\n{3,}/g, "\n\n").trim();
    if (!toAddress || !content) return NextResponse.json({ error: "Recipient and email body are required." }, { status: 400 });

    const { data: messages, error: messageError } = await supabase
      .from("crm_emails")
      .select("provider_account_id,provider_message_id,direction,received_at,sent_at")
      .eq("organisation_id", profile.organisation_id)
      .eq("thread_id", id)
      .eq("provider", "zoho");

    if (messageError || !messages?.length) {
      return NextResponse.json({ error: "This thread is not linked to a Zoho mailbox." }, { status: 400 });
    }

    const ordered = [...messages].sort((a: any, b: any) =>
      new Date(b.received_at || b.sent_at || 0).getTime() - new Date(a.received_at || a.sent_at || 0).getTime()
    );
    const latestInbound = ordered.find((row: any) => row.direction === "inbound") || null;
    const accountId = String((latestInbound || ordered[0]).provider_account_id || "");
    if (!accountId) return NextResponse.json({ error: "Zoho account ID is unavailable for this thread." }, { status: 400 });

    const { data: account } = await supabase
      .from("crm_email_accounts")
      .select("provider_account_id,mailbox_address,primary_email,mcp_connection_id")
      .eq("organisation_id", profile.organisation_id)
      .eq("provider", "zoho")
      .eq("provider_account_id", accountId)
      .maybeSingle();

    if (!account?.mcp_connection_id) {
      return NextResponse.json({ error: "Reconnect this Zoho mailbox from Connections first." }, { status: 400 });
    }

    const { data: connection, error: connectionError } = await supabase
      .from("crm_mcp_connections")
      .select("*")
      .eq("id", account.mcp_connection_id)
      .eq("organisation_id", profile.organisation_id)
      .eq("provider", "zoho")
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json({ error: "Zoho MCP connection is unavailable." }, { status: 400 });
    }

    const accessToken = await getConnectionAccessToken(supabase, connection as any);
    let tools = Array.isArray(connection.tools_cache) ? connection.tools_cache as RemoteTool[] : [];
    if (!tools.length) {
      const listed = await listRemoteTools(connection.server_url, accessToken);
      tools = listed.tools as RemoteTool[];
    }

    const replyTool = findTool(tools, "ZohoMail_sendReplyEmail", ["send reply email", "reply email"]);
    const sendTool = findTool(tools, "ZohoMail_sendEmail", ["send email"]);
    const fromAddress = account.mailbox_address || account.primary_email;

    if (!fromAddress) return NextResponse.json({ error: "Zoho sender address is unavailable." }, { status: 400 });

    if (latestInbound && replyTool) {
      await callRemoteTool(
        connection.server_url,
        replyTool.name,
        {
          path_variables: {
            accountId,
            messageId: String(latestInbound.provider_message_id),
          },
          body: {
            action: "reply",
            fromAddress,
            toAddress,
            subject,
            content,
            mailFormat: "plaintext",
            encoding: "UTF-8",
            mode: "draft",
          },
        },
        accessToken,
      );
    } else {
      if (!sendTool) return NextResponse.json({ error: "Zoho MCP does not expose a draft-capable send tool." }, { status: 400 });
      await callRemoteTool(
        connection.server_url,
        sendTool.name,
        {
          path_variables: { accountId },
          body: {
            fromAddress,
            toAddress,
            subject,
            content,
            mailFormat: "plaintext",
            encoding: "UTF-8",
            mode: "draft",
            includeSignature: true,
          },
        },
        accessToken,
      );
    }

    return NextResponse.json({
      success: true,
      open_url: "https://mail.zoho.com/zm/#drafts",
      message: "Draft saved in Zoho Mail.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create Zoho draft" },
      { status: 500 },
    );
  }
}
