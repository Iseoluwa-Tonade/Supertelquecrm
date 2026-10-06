import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/mcp/crypto";
import { initializeMcp, rawMcpRequest } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RemoteTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
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
type SyncState = {
  mcp_connection_id: string;
  provider_account_id: string;
  last_sync_at: string | null;
  sync_cursor: Record<string, unknown> | null;
};

const EDGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crm-email-sync`;

async function edge(secret: string, action: string, body: Record<string, unknown> = {}) {
  const response = await fetch(EDGE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({ secret, action, ...body }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `CRM email worker failed (${response.status})`);
  return data;
}

function normalize(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function findTool(tools: RemoteTool[], exact: string, phrases: string[]) {
  return tools.find((tool) => tool.name === exact) || tools.find((tool) => {
    const haystack = normalize([tool.name, tool.title, tool.description].filter(Boolean).join(" "));
    return phrases.some((phrase) => haystack.includes(normalize(phrase)));
  }) || null;
}
function parseText(text: string) {
  try { return JSON.parse(text); } catch { return text; }
}
function unwrap(value: any): any {
  if (value == null) return value;
  if (value.structuredContent != null) return unwrap(value.structuredContent);
  if (Array.isArray(value.content)) {
    for (const part of value.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        const parsed = parseText(part.text);
        if (parsed !== part.text) return unwrap(parsed);
      }
    }
  }
  if (value?.data != null) return unwrap(value.data);
  return value;
}
function asArray(value: any) {
  const data = unwrap(value);
  if (Array.isArray(data)) return data;
  for (const key of ["items","results","accounts","folders","messages","emails","data"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}
function buildArgs(tool: RemoteTool, path: Record<string, unknown>, query: Record<string, unknown>) {
  const props = tool.inputSchema?.properties || {};
  const args: Record<string, unknown> = {};
  if ("path_variables" in props) args.path_variables = path;
  else Object.assign(args, path);
  if ("query_params" in props) args.query_params = query;
  else Object.assign(args, query);
  return args;
}
function extractAddresses(value: unknown) {
  const text = Array.isArray(value) ? value.join(",") : String(value || "");
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((email) => email.toLowerCase()))];
}
function extractName(value: unknown, email: string | null) {
  const raw = String(value || "");
  if (!email) return null;
  const before = raw.split(email)[0].replace(/[<>"']/g, "").trim();
  return before || null;
}
function toIso(value: unknown) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return new Date(number).toISOString();
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
function normalizedSubject(value: unknown) {
  let subject = String(value || "").trim();
  while (/^(re|fw|fwd)\s*:/i.test(subject)) subject = subject.replace(/^(re|fw|fwd)\s*:\s*/i, "");
  return subject.toLowerCase().replace(/\s+/g, " ").trim();
}
function syntheticThreadId(accountId: string, externalEmail: string, subject: string, messageId: string) {
  if (!externalEmail && !subject) return `message:${messageId}`;
  const basis = `${accountId}|${externalEmail}|${normalizedSubject(subject) || "(no subject)"}`;
  return `synthetic:${createHash("sha256").update(basis).digest("hex").slice(0, 32)}`;
}

async function tokenFor(connection: Connection) {
  if (connection.auth_type === "none") return { accessToken: null as string | null, tokenPatch: null as Record<string, unknown> | null };
  let accessToken = await decryptSecret(connection.access_token_enc);
  if (!accessToken) throw new Error("Zoho MCP needs authorization. Reconnect it from Connections.");

  if (connection.auth_type !== "oauth") return { accessToken, tokenPatch: null as Record<string, unknown> | null };

  const expires = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (!expires || expires > Date.now() + 90_000) return { accessToken, tokenPatch: null as Record<string, unknown> | null };

  const refreshToken = await decryptSecret(connection.refresh_token_enc);
  if (!refreshToken || !connection.token_endpoint || !connection.client_id) {
    throw new Error("Zoho MCP authorization expired. Reconnect Zoho Mail in Connections.");
  }

  const clientSecret = await decryptSecret(connection.client_secret_enc);
  const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: connection.client_id });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${connection.client_id}:${clientSecret}`).toString("base64")}`;
    form.delete("client_id");
  }

  const response = await fetch(connection.token_endpoint, { method: "POST", headers, body: form, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "Zoho OAuth refresh failed");

  accessToken = payload.access_token;
  return {
    accessToken,
    tokenPatch: {
      access_token_enc: await encryptSecret(payload.access_token),
      refresh_token_enc: await encryptSecret(payload.refresh_token || refreshToken),
      token_type: payload.token_type || connection.token_type || "Bearer",
      token_expires_at: payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString() : connection.token_expires_at,
      scope: payload.scope || connection.scope,
    },
  };
}

async function analyzeChangedThreads(secret: string, organisationId: string, threadIds: string[]) {
  if (!threadIds.length) return { analyzed: 0, errors: 0 };
  const context = await edge(secret, "ai_context", { organisation_id: organisationId, thread_ids: threadIds });
  const settings = context.settings;
  if (!settings?.enabled || !settings?.analyze_new_email || !settings?.api_key_enc) {
    return { analyzed: 0, errors: 0 };
  }

  const apiKey = await decryptSecret(settings.api_key_enc);
  if (!apiKey) return { analyzed: 0, errors: 0 };
  const model = settings.model || "gpt-6-luna";
  const rows: any[] = [];

  for (const item of context.threads || []) {
    if (!item.latest_message_id || item.latest_message_id === item.previous_last_message_id) continue;

    const transcript = (item.messages || []).map((message: any) => {
      const body = String(message.body_text || message.summary || "").slice(0, 8000);
      return [
        `[${message.direction || "message"}]`,
        `From: ${message.from_name || message.from_address || "unknown"}`,
        `To: ${(message.to_addresses || []).join(", ") || "unknown"}`,
        `Subject: ${message.subject || "(no subject)"}`,
        body,
      ].join("\n");
    }).join("\n\n---\n\n").slice(-45000);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          store: false,
          instructions: [
            "Analyze this business email thread using only facts in the thread.",
            "Return a concise summary, one useful business insight, and one specific next action.",
            "Only suggest a reply when a reply or follow-up is actually useful.",
            "A suggested email must have a natural greeting, short paragraphs, a clear ask or next step, and a professional closing.",
            "Do not use Markdown in the email body.",
            "Never use an em dash or en dash. Use commas, periods, colons, parentheses, or a normal hyphen.",
            "Do not invent names, titles, phone numbers, company names, commitments, dates, or commercial facts."
          ].join(" "),
          input: `Subject: ${item.thread?.subject || "(no subject)"}\n\n${transcript}`,
          text: {
            format: {
              type: "json_schema",
              name: "email_thread_intelligence",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  summary: { type: ["string","null"] },
                  insight: { type: ["string","null"] },
                  next_action: { type: ["string","null"] },
                  needs_reply: { type: "boolean" },
                  suggested_to: { type: ["string","null"] },
                  suggested_subject: { type: ["string","null"] },
                  suggested_body: { type: ["string","null"] },
                  rationale: { type: ["string","null"] },
                  contact_name: { type: ["string","null"] },
                  contact_job_title: { type: ["string","null"] },
                  contact_phone: { type: ["string","null"] },
                  company_name: { type: ["string","null"] }
                },
                required: ["summary","insight","next_action","needs_reply","suggested_to","suggested_subject","suggested_body","rationale","contact_name","contact_job_title","contact_phone","company_name"]
              }
            }
          }
        }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || "OpenAI analysis failed");
      const output = payload.output_text || payload.output?.flatMap((entry: any) => entry.content || []).find((part: any) => part.type === "output_text")?.text || "";
      const parsed = JSON.parse(output);
      if (parsed.needs_reply && !parsed.suggested_to) {
        const lastInbound = [...(item.messages || [])].reverse().find((m: any) => m.direction === "inbound" && m.from_address);
        parsed.suggested_to = lastInbound?.from_address || null;
      }
      if (parsed.needs_reply && !parsed.suggested_subject) {
        const subject = item.thread?.subject || "";
        parsed.suggested_subject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
      }
      if (typeof parsed.suggested_body === "string") {
        parsed.suggested_body = parsed.suggested_body.replace(/[—–]/g, "-").replace(/\n{3,}/g, "\n\n").trim();
      }
      rows.push({ thread_id: item.thread.id, last_message_id: item.latest_message_id, model, status: "ready", ...parsed, error: null });
    } catch (error) {
      rows.push({
        thread_id: item.thread.id,
        last_message_id: item.latest_message_id,
        model,
        status: "error",
        error: error instanceof Error ? error.message : "AI analysis failed",
      });
    }
  }

  if (rows.length) await edge(secret, "save_ai", { organisation_id: organisationId, rows });
  return {
    analyzed: rows.filter((row) => row.status === "ready").length,
    errors: rows.filter((row) => row.status === "error").length,
  };
}

async function syncAccount(
  secret: string,
  connection: Connection,
  tools: RemoteTool[],
  account: any,
  state: SyncState | undefined,
  accessToken: string | null,
  session: any,
  tokenPatch: Record<string, unknown> | null,
) {
  let rpcId = 100;
  const call = async (tool: RemoteTool, args: Record<string, unknown>) => {
    const result = await rawMcpRequest(
      connection.server_url,
      { jsonrpc: "2.0", id: rpcId++, method: "tools/call", params: { name: tool.name, arguments: args } },
      accessToken,
      session,
    );
    if (!result.response.ok || result.payload?.error) throw new Error(result.payload?.error?.message || `${tool.name} failed`);
    return result.payload?.result;
  };

  const foldersTool = findTool(tools, "ZohoMail_getAllFolders", ["get all folders","list folders"]);
  const emailsTool = findTool(tools, "ZohoMail_listEmails", ["list emails"]);
  const contentTool = findTool(tools, "ZohoMail_getMessageContent", ["message content"]);
  if (!foldersTool || !emailsTool) throw new Error("Zoho MCP is missing folder or list-email tools.");

  const accountId = String(account.accountId || account.account_id || account.id || "");
  if (!accountId) throw new Error("Zoho MCP returned an account without an account ID.");

  const addressRows = Array.isArray(account.emailAddress) ? account.emailAddress : [];
  const aliases = [...new Set([
    account.mailboxAddress,
    account.incomingUserName,
    account.primaryEmailAddress,
    ...addressRows.map((row: any) => row.mailId || row.email),
  ].filter(Boolean).map((value) => String(value).toLowerCase()))];

  const mailboxAddress = String(account.mailboxAddress || account.incomingUserName || account.primaryEmailAddress || aliases[0] || `zoho-${accountId}`).toLowerCase();
  const initialImport = !state?.last_sync_at;

  const folderResult = await call(
    foldersTool,
    buildArgs(foldersTool, { accountId }, { fields: "folderId,folderName,folderType,path,previousFolderId,isArchived,imapAccess,URI" }),
  );
  const folders = asArray(folderResult).filter((folder: any) => {
    const name = String(folder.folderName || folder.folderType || "").toLowerCase();
    return !["spam","trash","templates","drafts","outbox"].includes(name);
  });

  const messageMap = new Map<string, any>();
  for (const folder of folders) {
    const folderId = String(folder.folderId || folder.id || "");
    const folderName = String(folder.folderName || folder.folderType || "Other");
    if (!folderId) continue;

    const pageSize = 100;
    const maxPages = initialImport ? 25 : 1;
    for (let page = 0; page < maxPages; page += 1) {
      const result = await call(
        emailsTool,
        buildArgs(emailsTool, { accountId }, {
          fields: "summary,sentDateInGMT,subject,messageId,threadCount,toAddress,folderId,ccAddress,threadId,hasAttachment,size,sender,receivedTime,fromAddress,status",
          folderId,
          limit: pageSize,
          start: page * pageSize + 1,
          sortBy: "date",
          sortorder: false,
          status: "all",
        }),
      );
      const rows = asArray(result);
      for (const row of rows) {
        const messageId = String(row.messageId || row.message_id || row.id || "");
        if (messageId) messageMap.set(messageId, { row, folderId, folderName });
      }
      if (rows.length < pageSize) break;
    }
  }

  const allIds = [...messageMap.keys()];
  const known = new Set<string>();
  if (!initialImport) {
    for (let i = 0; i < allIds.length; i += 250) {
      const result = await edge(secret, "known", {
        organisation_id: connection.organisation_id,
        provider_account_id: accountId,
        message_ids: allIds.slice(i, i + 250),
      });
      for (const id of result.known || []) known.add(String(id));
    }
  }

  const emails: any[] = [];
  const threads = new Map<string, any>();
  for (const [messageId, value] of messageMap.entries()) {
    if (!initialImport && known.has(messageId)) continue;
    const row = value.row;
    const fromAddress = extractAddresses(row.fromAddress || row.sender)[0] || null;
    const toAddresses = extractAddresses(row.toAddress || row.to);
    const ccAddresses = extractAddresses(row.ccAddress || row.cc);
    const folderLower = value.folderName.toLowerCase();
    const direction =
      ["sent","drafts","outbox"].includes(folderLower) ||
      (fromAddress && aliases.includes(fromAddress.toLowerCase()))
        ? "outbound"
        : "inbound";
    const externalEmail = direction === "inbound"
      ? (fromAddress && !aliases.includes(fromAddress.toLowerCase()) ? fromAddress.toLowerCase() : "")
      : (toAddresses.find((address) => !aliases.includes(address.toLowerCase())) || "").toLowerCase();
    const subject = String(row.subject || "");
    const providerThreadId = String(
      row.threadId ||
      row.thread_id ||
      syntheticThreadId(accountId, externalEmail, subject, messageId)
    );
    const timestamp = toIso(row.receivedTime || row.sentDateInGMT);
    const email = {
      provider_account_id: accountId,
      provider_message_id: messageId,
      provider_thread_id: providerThreadId,
      folder_id: value.folderId,
      folder_name: value.folderName,
      direction,
      from_address: fromAddress,
      from_name: extractName(row.fromAddress || row.sender, fromAddress),
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      bcc_addresses: [],
      subject: subject || null,
      summary: row.summary || null,
      body_text: null,
      body_html: null,
      sent_at: direction === "outbound" ? timestamp : null,
      received_at: timestamp,
      is_read: String(row.status ?? "") === "1",
      has_attachments: Boolean(row.hasAttachment),
    };
    emails.push(email);

    const current = threads.get(providerThreadId);
    const next = {
      provider_account_id: accountId,
      provider_thread_id: providerThreadId,
      subject: subject || current?.subject || null,
      last_message_at: timestamp || current?.last_message_at || null,
      message_count: Math.max(Number(row.threadCount || 1), Number(current?.message_count || 1)),
    };
    if (!current || new Date(next.last_message_at || 0).getTime() >= new Date(current.last_message_at || 0).getTime()) {
      threads.set(providerThreadId, next);
    }
  }

  if (!initialImport && contentTool && emails.length) {
    for (let i = 0; i < Math.min(emails.length, 50); i += 5) {
      const batch = emails.slice(i, i + 5);
      const bodies = await Promise.all(batch.map(async (email) => {
        try {
          const result = await call(
            contentTool,
            buildArgs(contentTool, {
              accountId,
              folderId: email.folder_id,
              messageId: email.provider_message_id,
            }, { includeBlockContent: true }),
          );
          const data = unwrap(result);
          return typeof data?.content === "string" ? data.content : null;
        } catch { return null; }
      }));
      bodies.forEach((html, offset) => {
        if (!html) return;
        const email = batch[offset];
        email.body_html = html;
        email.body_text = stripHtml(html);
        if (!email.summary) email.summary = email.body_text.slice(0, 350);
      });
    }
  }

  const applied = await edge(secret, "apply", {
    connection_id: connection.id,
    payload: {
      token_patch: tokenPatch,
      accounts: [{
        provider_account_id: accountId,
        mailbox_address: mailboxAddress,
        primary_email: String(account.primaryEmailAddress || mailboxAddress).toLowerCase(),
        display_name: account.displayName || account.accountDisplayName || account.accountName || null,
        aliases,
        is_default: Boolean(account.isDefaultAccount),
        last_sync_at: new Date().toISOString(),
      }],
      threads: [...threads.values()],
      emails,
      states: [{
        provider_account_id: accountId,
        last_sync_at: new Date().toISOString(),
        sync_cursor: {
          mode: initialImport ? "initial-mcp-cache" : "incremental-mcp",
          initial_import_complete: true,
          last_checked_at: new Date().toISOString(),
        },
        status: "idle",
        last_error: null,
      }],
      initial_import: initialImport,
    },
  });

  const ai = applied.affected_thread_ids?.length
    ? await analyzeChangedThreads(secret, connection.organisation_id, applied.affected_thread_ids)
    : { analyzed: 0, errors: 0 };

  return {
    account_id: accountId,
    mailbox: mailboxAddress,
    initial_import: initialImport,
    checked: messageMap.size,
    new_emails: Number(applied.inserted_messages || 0),
    contacts_linked: Number(applied.linked?.contacts || 0),
    companies_linked: Number(applied.linked?.companies || 0),
    ai,
  };
}

async function authorize(request: NextRequest) {
  const secret = process.env.EMAIL_SYNC_BRIDGE_SECRET || "";
  const authHeader = request.headers.get("authorization") || "";
  if (secret && authHeader === `Bearer ${secret}`) {
    return { secret, organisationId: null as string | null };
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("organisation_id,role,status")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!profile?.organisation_id || profile.status !== "active" || !["admin","manager"].includes(profile.role)) return null;
  return { secret, organisationId: profile.organisation_id as string };
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth?.secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const bootstrap = await edge(auth.secret, "bootstrap", auth.organisationId ? { organisation_id: auth.organisationId } : {});
    const states = (bootstrap.states || []) as SyncState[];
    const results: any[] = [];

    for (const connection of (bootstrap.connections || []) as Connection[]) {
      try {
        const { accessToken, tokenPatch } = await tokenFor(connection);
        const session = await initializeMcp(connection.server_url, accessToken);
        let tools = Array.isArray(connection.tools_cache) ? connection.tools_cache : [];
        if (!tools.length) {
          const listed = await rawMcpRequest(
            connection.server_url,
            { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
            accessToken,
            session,
          );
          if (!listed.response.ok || listed.payload?.error) throw new Error(listed.payload?.error?.message || "Could not list Zoho MCP tools");
          tools = listed.payload?.result?.tools || [];
        }

        const accountsTool = findTool(tools, "ZohoMail_getMailAccounts", ["get mail accounts"]);
        if (!accountsTool) throw new Error("Zoho MCP is missing the mail accounts tool");

        const accountResult = await rawMcpRequest(
          connection.server_url,
          { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: accountsTool.name, arguments: {} } },
          accessToken,
          session,
        );
        if (!accountResult.response.ok || accountResult.payload?.error) throw new Error(accountResult.payload?.error?.message || "Could not read Zoho mail accounts");
        const accounts = asArray(accountResult.payload?.result);
        if (!accounts.length) throw new Error("Zoho MCP returned no mail accounts");

        const accountResults = [];
        for (const account of accounts) {
          const accountId = String(account.accountId || account.account_id || account.id || "");
          const state = states.find((row) => row.mcp_connection_id === connection.id && String(row.provider_account_id) === accountId);
          accountResults.push(await syncAccount(auth.secret, connection, tools, account, state, accessToken, session, tokenPatch));
        }

        results.push({ connection_id: connection.id, connection_name: connection.name, accounts: accountResults });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Zoho MCP sync failed";
        await edge(auth.secret, "mark_error", { connection_id: connection.id, error: message }).catch(() => null);
        results.push({ connection_id: connection.id, connection_name: connection.name, error: message, accounts: [] });
      }
    }

    if (!results.length) {
      return NextResponse.json({ error: "No Zoho MCP connection found. Add or reconnect Zoho Mail in Connections." }, { status: 400 });
    }
    return NextResponse.json({
      ok: results.every((row) => !row.error),
      checked_at: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "MCP email sync failed" }, { status: 500 });
  }
}
