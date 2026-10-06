import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyzeEmailThreadIfChanged } from "@/lib/ai/email-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONAL_DOMAINS = new Set([
  "gmail.com","googlemail.com","yahoo.com","outlook.com","hotmail.com","live.com",
  "icloud.com","me.com","aol.com","proton.me","protonmail.com","mail.com","gmx.com","yandex.com",
]);

function domainOf(email: string) {
  return email.split("@")[1]?.toLowerCase() || "";
}
function companyName(domain: string) {
  return (domain.split(".")[0] || domain).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function normalizedSubject(value: string) {
  let subject = value.trim();
  while (/^(re|fw|fwd)\s*:/i.test(subject)) subject = subject.replace(/^(re|fw|fwd)\s*:\s*/i, "");
  return subject.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation_id,role,status,display_name,email")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!profile?.organisation_id || profile.status !== "active" || !["admin","manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Email entry requires Admin or Manager permission." }, { status: 403 });
    }

    const body = await request.json();
    const direction = body.direction === "outbound" ? "outbound" : "inbound";
    const from = String(body.from || "").trim().toLowerCase();
    const to = String(body.to || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    const messageBody = String(body.body || "").replace(/[—–]/g, "-").replace(/\n{3,}/g, "\n\n").trim();
    const occurredAt = body.occurred_at ? new Date(body.occurred_at).toISOString() : new Date().toISOString();

    if (!from.includes("@") || !to.includes("@") || !messageBody) {
      return NextResponse.json({ error: "From, To and message body are required." }, { status: 400 });
    }

    const accountId = `manual:${auth.user.id}`;
    const ownAddress = direction === "outbound" ? from : to;
    const externalEmail = direction === "inbound" ? from : to;
    const domain = domainOf(externalEmail);

    await supabase.from("crm_email_accounts").upsert({
      organisation_id: profile.organisation_id,
      provider: "manual",
      provider_account_id: accountId,
      mailbox_address: ownAddress,
      primary_email: ownAddress,
      display_name: profile.display_name || profile.email || ownAddress,
      aliases: [ownAddress],
      status: "connected",
      is_default: false,
      last_sync_at: occurredAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organisation_id,provider,provider_account_id" });

    let companyId: string | null = null;
    if (domain && !PERSONAL_DOMAINS.has(domain)) {
      const { data: existing } = await supabase.from("crm_companies")
        .select("id").eq("organisation_id", profile.organisation_id).ilike("domain", domain).maybeSingle();
      companyId = existing?.id || null;
      if (!companyId) {
        const { data: created, error } = await supabase.from("crm_companies").insert({
          organisation_id: profile.organisation_id,
          name: companyName(domain),
          domain,
          website: "https://" + domain,
          status: "prospect",
          source: "manual",
          created_by: auth.user.id,
        }).select("id").single();
        if (error) throw error;
        companyId = created.id;
      }
    }

    let contactId: string | null = null;
    const { data: existingContact } = await supabase.from("crm_contacts")
      .select("id,company_id").eq("organisation_id", profile.organisation_id).ilike("email", externalEmail).maybeSingle();
    contactId = existingContact?.id || null;
    if (!contactId) {
      const { data: created, error } = await supabase.from("crm_contacts").insert({
        organisation_id: profile.organisation_id,
        company_id: companyId,
        display_name: String(body.contact_name || "").trim() || externalEmail.split("@")[0],
        email: externalEmail,
        status: "active",
        source: "manual",
        last_contacted_at: occurredAt,
        created_by: auth.user.id,
      }).select("id").single();
      if (error) throw error;
      contactId = created.id;
    } else {
      await supabase.from("crm_contacts").update({
        ...(companyId && !existingContact?.company_id ? { company_id: companyId } : {}),
        last_contacted_at: occurredAt,
        updated_at: new Date().toISOString(),
      }).eq("id", contactId);
    }

    const threadKey = createHash("sha256")
      .update(`${accountId}|${externalEmail}|${normalizedSubject(subject) || "(no subject)"}`)
      .digest("hex")
      .slice(0, 32);
    const providerThreadId = "manual:" + threadKey;

    const { data: thread, error: threadError } = await supabase.from("crm_email_threads").upsert({
      organisation_id: profile.organisation_id,
      provider: "manual",
      provider_account_id: accountId,
      provider_thread_id: providerThreadId,
      subject: subject || "(no subject)",
      last_message_at: occurredAt,
      message_count: 1,
      contact_id: contactId,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organisation_id,provider,provider_account_id,provider_thread_id" })
      .select("id,message_count").single();
    if (threadError) throw threadError;

    const messageId = "manual:" + randomUUID();
    const { error: emailError } = await supabase.from("crm_emails").insert({
      organisation_id: profile.organisation_id,
      thread_id: thread.id,
      provider: "manual",
      provider_account_id: accountId,
      provider_message_id: messageId,
      provider_thread_id: providerThreadId,
      folder_name: direction === "outbound" ? "Sent" : "Inbox",
      direction,
      from_address: from,
      from_name: direction === "inbound" ? String(body.contact_name || "").trim() || null : profile.display_name || null,
      to_addresses: [to],
      cc_addresses: [],
      bcc_addresses: [],
      subject: subject || null,
      summary: messageBody.slice(0, 350),
      body_text: messageBody,
      body_html: null,
      sent_at: direction === "outbound" ? occurredAt : null,
      received_at: occurredAt,
      is_read: true,
      has_attachments: false,
    });
    if (emailError) throw emailError;

    const { count } = await supabase.from("crm_emails").select("id", { count: "exact", head: true }).eq("thread_id", thread.id);
    await supabase.from("crm_email_threads").update({ message_count: count || 1, last_message_at: occurredAt, updated_at: new Date().toISOString() }).eq("id", thread.id);

    await analyzeEmailThreadIfChanged(supabase, profile.organisation_id, thread.id);

    return NextResponse.json({ success: true, thread_id: thread.id, contact_id: contactId, company_id: companyId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add manual email" }, { status: 500 });
  }
}
