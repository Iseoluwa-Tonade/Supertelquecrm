import { NextRequest, NextResponse } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/mcp/crypto";
import { initializeMcp, rawMcpRequest } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RemoteTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
};

type Connection = {
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
  token_type: string | null;
  token_expires_at: string | null;
  scope: string | null;
  tools_cache: RemoteTool[] | null;
};

function normalize(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toolScore(tool: RemoteTool, patterns: string[]) {
  const haystack = normalize([tool.name, tool.title, tool.description].filter(Boolean).join(" "));
  return patterns.reduce((score, pattern) => score + (haystack.includes(normalize(pattern)) ? 1 : 0), 0);
}

function findTool(tools: RemoteTool[], patterns: string[]) {
  return [...tools]
    .map((tool) => ({ tool, score: toolScore(tool, patterns) }))
    .sort((a, b) => b.score - a.score)[0]?.score
    ? [...tools]
        .map((tool) => ({ tool, score: toolScore(tool, patterns) }))
        .sort((a, b) => b.score - a.score)[0].tool
    : null;
}

function parseTextContent(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrap(value: any): any {
  if (value == null) return value;
  if (value.structuredContent != null) return unwrap(value.structuredContent);
  if (Array.isArray(value.content)) {
    for (const part of value.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        const parsed = parseTextContent(part.text);
        if (parsed !== part.text) return unwrap(parsed);
      }
    }
  }
  if (typeof value === "object" && !Array.isArray(value) && "data" in value) {
    return unwrap(value.data);
  }
  return value;
}

function asArray(value: any) {
  const unwrapped = unwrap(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && Array.isArray(unwrapped.items)) return unwrapped.items;
  if (unwrapped && Array.isArray(unwrapped.results)) return unwrapped.results;
  return [];
}

function decodeEntities(value: string | null | undefined) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractAddresses(value: unknown) {
  const text = Array.isArray(value) ? value.join(",") : decodeEntities(String(value || ""));
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((email) => email.toLowerCase()))];
}

function fromName(value: unknown) {
  const text = decodeEntities(String(value || ""));
  const email = extractAddresses(text)[0];
  if (!email) return null;
  const before = text.split(email)[0].replace(/[<>"']/g, "").trim();
  return before || null;
}

function isoFromMs(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number).toISOString();
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

function buildArgs(tool: RemoteTool, pathVariables: Record<string, unknown>, queryParams: Record<string, unknown>) {
  const props = tool.inputSchema?.properties || {};
  const args: Record<string, unknown> = {};

  if ("path_variables" in props) args.path_variables = pathVariables;
  else {
    for (const [key, value] of Object.entries(pathVariables)) {
      if (!Object.keys(props).length || key in props) args[key] = value;
    }
  }

  if ("query_params" in props) args.query_params = queryParams;
  else {
    for (const [key, value] of Object.entries(queryParams)) {
      if (!Object.keys(props).length || key in props) args[key] = value;
    }
  }

  return args;
}

async function resolveAccessToken(connection: Connection) {
  if (connection.auth_type === "none") {
    return { accessToken: null as string | null, tokenPatch: null as Record<string, unknown> | null };
  }

  let accessToken = await decryptSecret(connection.access_token_enc);
  if (!accessToken) throw new Error("Zoho MCP connection is not authorized");

  if (connection.auth_type === "bearer") {
    return { accessToken, tokenPatch: null as Record<string, unknown> | null };
  }

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  const shouldRefresh = expiresAt > 0 && expiresAt < Date.now() + 90_000;
  if (!shouldRefresh) {
    return { accessToken, tokenPatch: null as Record<string, unknown> | null };
  }

  const refreshToken = await decryptSecret(connection.refresh_token_enc);
  if (!refreshToken || !connection.token_endpoint || !connection.client_id) {
    throw new Error("Zoho MCP OAuth token expired and cannot be refreshed");
  }

  const clientSecret = await decryptSecret(connection.client_secret_enc);
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: connection.client_id,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${connection.client_id}:${clientSecret}`).toString("base64")}`;
    form.delete("client_id");
  }

  const response = await fetch(connection.token_endpoint, {
    method: "POST",
    headers,
    body: form,
    cache: "no-store",
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Zoho MCP OAuth refresh failed");
  }

  accessToken = token.access_token;
  return {
    accessToken,
    tokenPatch: {
      access_token_enc: await encryptSecret(token.access_token),
      refresh_token_enc: await encryptSecret(token.refresh_token || refreshToken),
      token_type: token.token_type || connection.token_type || "Bearer",
      token_expires_at: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : connection.token_expires_at,
      scope: token.scope || connection.scope,
    },
  };
}

export async function POST(request: NextRequest) {
  const expected = process.env.EMAIL_SYNC_BRIDGE_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fullHistory = body.full_history === true;
    const connection = body.connection as Connection;
    if (!connection?.id || connection.provider !== "zoho" || !/^https:\/\//i.test(connection.server_url)) {
      return NextResponse.json({ error: "Invalid Zoho MCP connection" }, { status: 400 });
    }

    const knownIds = new Set<string>((body.known_message_ids || []).map(String));
    const bodyBackfill = Array.isArray(body.body_backfill) ? body.body_backfill : [];

    const { accessToken, tokenPatch } = await resolveAccessToken(connection);
    const session = await initializeMcp(connection.server_url, accessToken);
    let callId = 20;

    const remoteCall = async (tool: RemoteTool, args: Record<string, unknown>) => {
      const result = await rawMcpRequest(
        connection.server_url,
        {
          jsonrpc: "2.0",
          id: callId++,
          method: "tools/call",
          params: { name: tool.name, arguments: args },
        },
        accessToken,
        session,
      );
      if (!result.response.ok || result.payload?.error) {
        throw new Error(result.payload?.error?.message || `MCP tool call failed: ${tool.name}`);
      }
      return result.payload?.result;
    };

    let tools = Array.isArray(connection.tools_cache) ? connection.tools_cache : [];
    if (!tools.length) {
      const listed = await rawMcpRequest(
        connection.server_url,
        { jsonrpc: "2.0", id: 10, method: "tools/list", params: {} },
        accessToken,
        session,
      );
      if (!listed.response.ok || listed.payload?.error) {
        throw new Error(listed.payload?.error?.message || "Could not list Zoho MCP tools");
      }
      tools = listed.payload?.result?.tools || [];
    }

    const accountsTool = findTool(tools, ["get mail accounts", "mail accounts", "getmailaccounts"]);
    const foldersTool = findTool(tools, ["all folders", "list folders", "getallfolders"]);
    const emailsTool = findTool(tools, ["list emails", "listemails"]);
    const contentTool = findTool(tools, ["message content", "getmessagecontent"]);

    if (!accountsTool || !foldersTool || !emailsTool) {
      throw new Error("Zoho MCP server must expose mail accounts, folders, and list-emails tools");
    }

    const accountResult = await remoteCall(accountsTool, buildArgs(accountsTool, {}, {}));
    const rawAccounts = asArray(accountResult);

    const accounts: any[] = [];
    const threads = new Map<string, any>();
    const emails = new Map<string, any>();
    const states: any[] = [];

    for (const account of rawAccounts) {
      const accountId = String(account.accountId || account.account_id || account.id || "");
      if (!accountId) continue;

      const addressRows = Array.isArray(account.emailAddress) ? account.emailAddress : [];
      const aliases = [
        ...new Set(
          addressRows
            .map((row: any) => String(row.mailId || row.email || "").toLowerCase())
            .filter(Boolean),
        ),
      ];
      const mailboxAddress = String(
        account.mailboxAddress || account.incomingUserName || account.primaryEmailAddress || aliases[0] || "",
      ).toLowerCase();
      const primaryEmail = String(account.primaryEmailAddress || aliases.find(Boolean) || mailboxAddress || "").toLowerCase();

      accounts.push({
        provider_account_id: accountId,
        mailbox_address: mailboxAddress || primaryEmail || `zoho-${accountId}`,
        primary_email: primaryEmail || null,
        display_name: account.displayName || account.accountDisplayName || account.accountName || null,
        aliases: [...new Set([mailboxAddress, primaryEmail, ...aliases].filter(Boolean))],
        is_default: Boolean(account.isDefaultAccount),
        last_sync_at: new Date().toISOString(),
      });

      const folderResult = await remoteCall(
        foldersTool,
        buildArgs(
          foldersTool,
          { accountId },
          { fields: "folderId,folderName,folderType,path,previousFolderId,isArchived,imapAccess,URI" },
        ),
      );
      const rawFolders = asArray(folderResult);
      const folders = rawFolders.filter((folder: any) => {
        const name = String(folder.folderName || folder.folderType || "").toLowerCase();
        return !["templates", "spam", "trash"].includes(name);
      });

      const ownAddresses = new Set(accounts.at(-1).aliases.map((email: string) => email.toLowerCase()));

      for (const folder of folders) {
        const folderId = String(folder.folderId || folder.id || "");
        const folderName = String(folder.folderName || folder.folderType || "Other");
        if (!folderId) continue;

        const metas: any[] = [];
        let start = 1;
        const pageSize = 200;
        const maxPages = fullHistory ? 30 : 1;

        for (let page = 0; page < maxPages; page++) {
          const emailResult = await remoteCall(
            emailsTool,
            buildArgs(
              emailsTool,
              { accountId },
              {
                fields:
                  "summary,sentDateInGMT,subject,messageId,threadCount,toAddress,folderId,ccAddress,threadId,hasAttachment,size,sender,receivedTime,fromAddress,status",
                folderId,
                limit: pageSize,
                start,
                sortBy: "date",
                sortorder: false,
                status: "all",
              },
            ),
          );

          const pageRows = asArray(emailResult);
          metas.push(...pageRows);
          if (!fullHistory || pageRows.length < pageSize) break;
          start += pageSize;
        }
        for (const meta of metas) {
          const messageId = String(meta.messageId || meta.message_id || meta.id || "");
          if (!messageId) continue;

          const providerThreadId = String(meta.threadId || meta.thread_id || `message:${messageId}`);
          const fromAddress = extractAddresses(meta.fromAddress || meta.sender)[0] || null;
          const toAddresses = extractAddresses(meta.toAddress || meta.to || []);
          const ccAddresses = extractAddresses(meta.ccAddress || meta.cc || []);
          const timestamp = isoFromMs(meta.receivedTime || meta.sentDateInGMT || meta.sentTime);
          const folderLower = folderName.toLowerCase();
          const direction =
            folderLower === "sent" || folderLower === "outbox" || folderLower === "drafts"
              ? "outbound"
              : fromAddress && ownAddresses.has(fromAddress.toLowerCase())
                ? "outbound"
                : "inbound";

          threads.set(providerThreadId, {
            provider_account_id: accountId,
            provider_thread_id: providerThreadId,
            subject: decodeEntities(meta.subject || "") || null,
            last_message_at: timestamp,
            message_count: Number(meta.threadCount || 1) || 1,
          });

          emails.set(messageId, {
            provider_account_id: accountId,
            provider_message_id: messageId,
            provider_thread_id: providerThreadId,
            folder_id: folderId,
            folder_name: folderName,
            direction,
            from_address: fromAddress,
            from_name: fromName(meta.fromAddress || meta.sender),
            to_addresses: toAddresses,
            cc_addresses: ccAddresses,
            bcc_addresses: [],
            subject: decodeEntities(meta.subject || "") || null,
            summary: decodeEntities(meta.summary || "") || null,
            body_text: null,
            body_html: null,
            sent_at: direction === "outbound" ? timestamp : null,
            received_at: timestamp,
            is_read: String(meta.status ?? "") === "1",
            has_attachments: Boolean(meta.hasAttachment),
          });
        }
      }

      states.push({
        provider_account_id: accountId,
        last_sync_at: new Date().toISOString(),
        sync_cursor: { mode: fullHistory ? "full-history-complete" : "latest-200-per-folder", connection_id: connection.id },
        status: "idle",
        last_error: null,
      });
    }

    if (contentTool) {
      const needBody = [
        ...[...emails.values()]
          .filter((message: any) => !knownIds.has(message.provider_message_id))
          .map((message: any) => ({
            accountId: message.provider_account_id,
            folderId: message.folder_id,
            messageId: message.provider_message_id,
          })),
        ...bodyBackfill.map((row: any) => ({
          accountId: String(row.provider_account_id || ""),
          folderId: String(row.folder_id || ""),
          messageId: String(row.provider_message_id || ""),
        })),
      ]
        .filter((row, index, all) =>
          row.accountId &&
          row.folderId &&
          row.messageId &&
          all.findIndex((other) => other.messageId === row.messageId) === index,
        )
        .slice(0, 40);

      for (let i = 0; i < needBody.length; i += 5) {
        const chunk = needBody.slice(i, i + 5);
        const resolved = await Promise.all(
          chunk.map(async (row) => {
            try {
              const result = await remoteCall(
                contentTool,
                buildArgs(
                  contentTool,
                  { accountId: row.accountId, folderId: row.folderId, messageId: row.messageId },
                  { includeBlockContent: true },
                ),
              );
              const data = unwrap(result);
              const html = typeof data?.content === "string" ? data.content : null;
              return { ...row, html };
            } catch {
              return { ...row, html: null };
            }
          }),
        );

        for (const row of resolved) {
          if (!row.html) continue;
          const existing = emails.get(row.messageId);
          if (existing) {
            existing.body_html = row.html;
            existing.body_text = stripHtml(row.html);
            if (!existing.summary) existing.summary = existing.body_text.slice(0, 300);
          } else {
            emails.set(row.messageId, {
              provider_account_id: row.accountId,
              provider_message_id: row.messageId,
              provider_thread_id: `message:${row.messageId}`,
              folder_id: row.folderId,
              folder_name: null,
              direction: "system",
              from_address: null,
              from_name: null,
              to_addresses: [],
              cc_addresses: [],
              bcc_addresses: [],
              subject: null,
              summary: stripHtml(row.html).slice(0, 300),
              body_text: stripHtml(row.html),
              body_html: row.html,
              sent_at: null,
              received_at: null,
              is_read: null,
              has_attachments: false,
            });
            threads.set(`message:${row.messageId}`, {
              provider_account_id: row.accountId,
              provider_thread_id: `message:${row.messageId}`,
              subject: null,
              last_message_at: null,
              message_count: 1,
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      token_patch: tokenPatch,
      tools_cache: tools,
      accounts,
      threads: [...threads.values()],
      emails: [...emails.values()],
      states,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Zoho MCP pull failed" },
      { status: 500 },
    );
  }
}
