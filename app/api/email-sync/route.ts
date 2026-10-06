import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/mcp/crypto";
import { callRemoteTool, listRemoteTools } from "@/lib/mcp/client";
import { analyzeEmailThreadIfChanged } from "@/lib/ai/email-intelligence";

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

function asArray(value: any) {
  const data = unwrap(value);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function buildArgs(tool: RemoteTool, pathVariables: Record<string, unknown>, queryParams: Record<string, unknown>) {
  const properties = tool.inputSchema?.properties || {};
  const args: Record<string, unknown> = {};
  if ("path_variables" in properties) args.path_variables = pathVariables;
  else Object.assign(args, pathVariables);
  if ("query_params" in properties) args.query_params = queryParams;
  else Object.assign(args, queryParams);
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
  const basis = `${accountId}|${externalEmail}|${normalizedSubject(subject) || "(no subject)"}`;
  if (!externalEmail && !subject) return `message:${messageId}`;
  return `synthetic:${createHash("sha256").update(basis).digest("hex").slice(0, 32)}`;
}

const FREE_DOMAINS = new Set([
  "gmail.com","googlemail.com","yahoo.com","outlook.com","hotmail.com","live.com",
  "icloud.com","me.com","aol.com","proton.me","protonmail.com","zoho.com",
]);

function companyName(domain: string) {
  const root = domain.split(".")[0] || domain;
  return root
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function resolveAccessToken(connection: any, supabase: any) {
  if (connection.auth_type === "none") return null;

  let accessToken = await decryptSecret(connection.access_token_enc);
  if (!accessToken) throw new Error("Zoho MCP is not authorized. Reconnect it from Connections.");

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (connection.auth_type !== "oauth" || !expiresAt || expiresAt > Date.now() + 90_000) {
    return accessToken;
  }

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

async function ensureCrmIdentity(
  supabase: any,
  organisationId: string,
  userId: string,
  email: string,
  displayName: string | null,
  contactedAt: string | null,
) {
  const normalizedEmail = email.toLowerCase();
  if (
    !normalizedEmail.includes("@") ||
    /(^|[._-])(no.?reply|do.?not.?reply|mailer.?daemon|postmaster|notifications?|newsletter)([._+-]|@)/i.test(normalizedEmail)
  ) return { contactId: null, companyId: null };

  const domain = normalizedEmail.split("@")[1] || "";
  let companyId: string | null = null;

  if (domain && !FREE_DOMAINS.has(domain)) {
    const { data: existingCompany } = await supabase
      .from("crm_companies")
      .select("id")
      .eq("organisation_id", organisationId)
      .ilike("domain", domain)
      .maybeSingle();

    companyId = existingCompany?.id || null;
    if (!companyId) {
      const { data: createdCompany } = await supabase
        .from("crm_companies")
        .insert({
          organisation_id: organisationId,
          name: companyName(domain) || domain,
          domain,
          website: `https://${domain}`,
          status: "prospect",
          source: "email",
          created_by: userId,
        })
        .select("id")
        .maybeSingle();
      companyId = createdCompany?.id || null;
    }
  }

  const { data: existingContact } = await supabase
    .from("crm_contacts")
    .select("id,company_id")
    .eq("organisation_id", organisationId)
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (existingContact?.id) {
    await supabase.from("crm_contacts").update({
      last_contacted_at: contactedAt || new Date().toISOString(),
      ...(companyId && !existingContact.company_id ? { company_id: companyId } : {}),
    }).eq("id", existingContact.id);
    return { contactId: existingContact.id, companyId: existingContact.company_id || companyId };
  }

  const local = normalizedEmail.split("@")[0] || normalizedEmail;
  const { data: createdContact } = await supabase
    .from("crm_contacts")
    .insert({
      organisation_id: organisationId,
      company_id: companyId,
      display_name: displayName || local.replace(/[._-]+/g, " "),
      email: normalizedEmail,
      status: "active",
      source: "email",
      last_contacted_at: contactedAt || new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .maybeSingle();

  return { contactId: createdContact?.id || null, companyId };
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation_id,role,status")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!profile?.organisation_id || profile.status !== "active" || !["admin","manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Only admins and managers can sync mail." }, { status: 403 });
    }

    const { data: connections, error: connectionError } = await supabase
      .from("crm_mcp_connections")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .eq("provider", "zoho")
      .in("status", ["connected", "attention"])
      .order("created_at");

    if (connectionError) throw connectionError;
    if (!connections?.length) {
      return NextResponse.json(
        { error: "No connected Zoho Mail MCP server. Connect one from Connections first." },
        { status: 400 },
      );
    }

    const results: any[] = [];

    for (const connection of connections) {
      try {
        const accessToken = await resolveAccessToken(connection, supabase);
        let tools = Array.isArray(connection.tools_cache) ? connection.tools_cache as RemoteTool[] : [];
        if (!tools.length) {
          const listed = await listRemoteTools(connection.server_url, accessToken);
          tools = listed.tools as RemoteTool[];
          await supabase.from("crm_mcp_connections").update({
            tools_cache: tools,
            last_connected_at: new Date().toISOString(),
            last_error: null,
          }).eq("id", connection.id);
        }

        const accountsTool = findTool(tools, ["getMailAccounts","mail accounts"]);
        const foldersTool = findTool(tools, ["getAllFolders","all folders","list folders"]);
        const emailsTool = findTool(tools, ["listEmails","list emails"]);
        const contentTool = findTool(tools, ["getMessageContent","message content"]);

        if (!accountsTool || !foldersTool || !emailsTool) {
          throw new Error("Zoho MCP needs Mail Accounts, Folders, and List Emails tools enabled.");
        }

        const rawAccounts = asArray(await callRemoteTool(connection.server_url, accountsTool.name, {}, accessToken));
        let newEmails = 0;
        let syncedEmails = 0;
        let newContacts = 0;
        let newCompanies = 0;
        let bodyFetches = 0;
        const newThreadIds = new Set<string>();

        for (const account of rawAccounts) {
          const accountId = String(account.accountId || account.account_id || account.id || "");
          if (!accountId) continue;

          const addressRows = Array.isArray(account.emailAddress) ? account.emailAddress : [];
          const aliases = [...new Set([
            account.mailboxAddress,
            account.incomingUserName,
            account.primaryEmailAddress,
            ...addressRows.map((row: any) => row.mailId || row.email),
          ].filter(Boolean).map((value) => String(value).toLowerCase()))];

          const mailboxAddress = String(
            account.mailboxAddress ||
            account.incomingUserName ||
            account.primaryEmailAddress ||
            aliases[0] ||
            `zoho-${accountId}`,
          ).toLowerCase();

          const { data: priorSync } = await supabase
            .from("crm_email_sync_state")
            .select("last_sync_at,sync_cursor")
            .eq("organisation_id", profile.organisation_id)
            .eq("provider", "zoho")
            .eq("provider_account_id", accountId)
            .maybeSingle();
          const initialImport = !priorSync?.last_sync_at;

          const { error: accountError } = await supabase
            .from("crm_email_accounts")
            .upsert({
              organisation_id: profile.organisation_id,
              provider: "zoho",
              provider_account_id: accountId,
              mailbox_address: mailboxAddress,
              primary_email: String(account.primaryEmailAddress || mailboxAddress).toLowerCase(),
              display_name: account.displayName || account.accountDisplayName || account.accountName || null,
              aliases,
              status: "connected",
              is_default: Boolean(account.isDefaultAccount),
              last_sync_at: new Date().toISOString(),
              mcp_connection_id: connection.id,
              updated_at: new Date().toISOString(),
            }, { onConflict: "organisation_id,provider,provider_account_id" });
          if (accountError) throw accountError;

          const folderResult = await callRemoteTool(
            connection.server_url,
            foldersTool.name,
            buildArgs(foldersTool, { accountId }, {
              fields: "folderId,folderName,folderType,path,previousFolderId,isArchived,imapAccess,URI",
            }),
            accessToken,
          );

          const folders = asArray(folderResult).filter((folder: any) => {
            const folderName = String(folder.folderName || folder.folderType || "").toLowerCase();
            return !["spam","trash","templates","drafts","outbox"].includes(folderName);
          });

          for (const folder of folders) {
            const folderId = String(folder.folderId || folder.id || "");
            const folderName = String(folder.folderName || folder.folderType || "Other");
            if (!folderId) continue;

            const rawMessages: any[] = [];
            const pageSize = 100;
            const maxPages = initialImport ? 25 : 1;
            for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
              const emailResult = await callRemoteTool(
                connection.server_url,
                emailsTool.name,
                buildArgs(emailsTool, { accountId }, {
                  fields: "summary,sentDateInGMT,subject,messageId,threadCount,toAddress,folderId,ccAddress,threadId,hasAttachment,size,sender,receivedTime,fromAddress,status",
                  folderId,
                  limit: pageSize,
                  start: pageIndex * pageSize + 1,
                  sortBy: "date",
                  sortorder: false,
                  status: "all",
                }),
                accessToken,
              );
              const pageRows = asArray(emailResult);
              rawMessages.push(...pageRows);
              if (pageRows.length < pageSize) break;
            }
            const messageIds = rawMessages
              .map((row: any) => String(row.messageId || row.message_id || row.id || ""))
              .filter(Boolean);

            const { data: existingRows } = messageIds.length
              ? await supabase
                  .from("crm_emails")
                  .select("provider_message_id,body_text")
                  .eq("organisation_id", profile.organisation_id)
                  .eq("provider", "zoho")
                  .eq("provider_account_id", accountId)
                  .in("provider_message_id", messageIds)
              : { data: [] as any[] };

            const existing = new Map((existingRows || []).map((row: any) => [String(row.provider_message_id), row]));
            const threadPayload = new Map<string, any>();
            const emailPayload: any[] = [];

            for (const row of rawMessages) {
              const messageId = String(row.messageId || row.message_id || row.id || "");
              if (!messageId) continue;
              const fromAddress = extractAddresses(row.fromAddress || row.sender)[0] || null;
              const toAddresses = extractAddresses(row.toAddress || row.to);
              const ccAddresses = extractAddresses(row.ccAddress || row.cc);
              const timestamp = toIso(row.receivedTime || row.sentDateInGMT);
              const lowerFolder = folderName.toLowerCase();
              const direction =
                ["sent","drafts","outbox"].includes(lowerFolder) ||
                (fromAddress && aliases.includes(fromAddress.toLowerCase()))
                  ? "outbound"
                  : "inbound";
              const externalEmail = direction === "inbound"
                ? (fromAddress && !aliases.includes(fromAddress.toLowerCase()) ? fromAddress.toLowerCase() : "")
                : (toAddresses.find((email: string) => !aliases.includes(email.toLowerCase())) || "").toLowerCase();
              const providerThreadId = String(
                row.threadId ||
                row.thread_id ||
                syntheticThreadId(accountId, externalEmail, String(row.subject || ""), messageId)
              );

              threadPayload.set(providerThreadId, {
                organisation_id: profile.organisation_id,
                provider: "zoho",
                provider_account_id: accountId,
                provider_thread_id: providerThreadId,
                subject: row.subject || null,
                last_message_at: timestamp,
                message_count: Number(row.threadCount || 1) || 1,
                updated_at: new Date().toISOString(),
              });

              emailPayload.push({
                organisation_id: profile.organisation_id,
                provider: "zoho",
                provider_account_id: accountId,
                provider_message_id: messageId,
                provider_thread_id: providerThreadId,
                folder_id: folderId,
                folder_name: folderName,
                direction,
                from_address: fromAddress,
                from_name: extractName(row.fromAddress || row.sender, fromAddress),
                to_addresses: toAddresses,
                cc_addresses: ccAddresses,
                bcc_addresses: [],
                subject: row.subject || null,
                summary: row.summary || null,
                sent_at: direction === "outbound" ? timestamp : null,
                received_at: timestamp,
                is_read: String(row.status ?? "") === "1",
                has_attachments: Boolean(row.hasAttachment),
              });
            }

            const { data: savedThreads, error: threadError } = threadPayload.size
              ? await supabase
                  .from("crm_email_threads")
                  .upsert([...threadPayload.values()], {
                    onConflict: "organisation_id,provider,provider_account_id,provider_thread_id",
                  })
                  .select("id,provider_thread_id")
              : { data: [] as any[], error: null };
            if (threadError) throw threadError;

            const threadIds = new Map((savedThreads || []).map((row: any) => [String(row.provider_thread_id), row.id]));
            for (const row of emailPayload) row.thread_id = threadIds.get(row.provider_thread_id) || null;

            if (emailPayload.length) {
              const { error: emailError } = await supabase
                .from("crm_emails")
                .upsert(emailPayload, {
                  onConflict: "organisation_id,provider,provider_account_id,provider_message_id",
                });
              if (emailError) throw emailError;
            }

            for (const message of emailPayload) {
              syncedEmails++;
              const prior = existing.get(message.provider_message_id);
              const isNew = !prior;
              if (isNew) {
                newEmails++;
                if (!initialImport && message.thread_id) newThreadIds.add(String(message.thread_id));
              }

              if (contentTool && (isNew || !prior?.body_text) && bodyFetches < (initialImport ? 10 : 50)) {
                try {
                  const contentResult = await callRemoteTool(
                    connection.server_url,
                    contentTool.name,
                    buildArgs(
                      contentTool,
                      { accountId, folderId, messageId: message.provider_message_id },
                      { includeBlockContent: true },
                    ),
                    accessToken,
                  );
                  const messageContent = unwrap(contentResult);
                  const html = typeof messageContent?.content === "string" ? messageContent.content : null;
                  if (html) {
                    bodyFetches++;
                    const text = stripHtml(html);
                    await supabase
                      .from("crm_emails")
                      .update({
                        body_html: html,
                        body_text: text,
                        summary: message.summary || text.slice(0, 350),
                      })
                      .eq("organisation_id", profile.organisation_id)
                      .eq("provider", "zoho")
                      .eq("provider_account_id", accountId)
                      .eq("provider_message_id", message.provider_message_id);
                  }
                } catch {}
              }

              if (!isNew) continue;

              const externalEmail =
                message.direction === "inbound"
                  ? message.from_address
                  : message.to_addresses.find((email: string) => !aliases.includes(email.toLowerCase())) || null;

              if (!externalEmail || aliases.includes(externalEmail.toLowerCase())) continue;

              const domain = externalEmail.split("@")[1] || "";
              const [{ count: contactCount }, companyCheck] = await Promise.all([
                supabase
                  .from("crm_contacts")
                  .select("id", { count: "exact", head: true })
                  .eq("organisation_id", profile.organisation_id)
                  .ilike("email", externalEmail),
                domain && !FREE_DOMAINS.has(domain)
                  ? supabase
                      .from("crm_companies")
                      .select("id", { count: "exact", head: true })
                      .eq("organisation_id", profile.organisation_id)
                      .ilike("domain", domain)
                  : Promise.resolve({ count: 0 }),
              ]);

              const linked = await ensureCrmIdentity(
                supabase,
                profile.organisation_id,
                auth.user.id,
                externalEmail,
                message.direction === "inbound" ? message.from_name : null,
                message.received_at || message.sent_at,
              );

              if ((contactCount || 0) === 0 && linked.contactId) newContacts++;
              if ((companyCheck.count || 0) === 0 && linked.companyId) newCompanies++;

              if (message.thread_id && (linked.contactId || linked.companyId)) {
                await supabase
                  .from("crm_email_threads")
                  .update({
                    ...(linked.contactId ? { contact_id: linked.contactId } : {}),
                    ...(linked.companyId ? { company_id: linked.companyId } : {}),
                  })
                  .eq("id", message.thread_id)
                  .eq("organisation_id", profile.organisation_id);
              }
            }
          }

          const { error: syncStateError } = await supabase
            .from("crm_email_sync_state")
            .upsert({
              organisation_id: profile.organisation_id,
              provider: "zoho",
              provider_account_id: accountId,
              last_sync_at: new Date().toISOString(),
              sync_cursor: { mode: initialImport ? "initial-mcp-cache" : "incremental-mcp", mcp_connection_id: connection.id, initial_import_complete: true },
              status: "idle",
              last_error: null,
              mcp_connection_id: connection.id,
              updated_at: new Date().toISOString(),
            }, { onConflict: "organisation_id,provider,provider_account_id" });
          if (syncStateError) throw syncStateError;
        }

        let analyzedThreads = 0;
        for (const threadId of newThreadIds) {
          const result = await analyzeEmailThreadIfChanged(
            supabase,
            profile.organisation_id,
            threadId,
          );
          if (result.analyzed) analyzedThreads += 1;
        }

        await supabase.from("crm_mcp_connections").update({
          last_connected_at: new Date().toISOString(),
          last_error: null,
          status: "connected",
          updated_at: new Date().toISOString(),
        }).eq("id", connection.id);

        results.push({
          connection_id: connection.id,
          connection_name: connection.name,
          new_emails: newEmails,
          synced_emails: syncedEmails,
          new_contacts: newContacts,
          new_companies: newCompanies,
          ai_analyzed_threads: analyzedThreads,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Zoho sync failed";
        await supabase.from("crm_mcp_connections").update({
          status: "attention",
          last_error: message,
          updated_at: new Date().toISOString(),
        }).eq("id", connection.id);

        results.push({
          connection_id: connection.id,
          connection_name: connection.name,
          error: message,
          new_emails: 0,
          synced_emails: 0,
          new_contacts: 0,
          new_companies: 0,
          ai_analyzed_threads: 0,
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email sync failed" },
      { status: 500 },
    );
  }
}
