import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/mcp/crypto";

type AiSettings = {
  model: string;
  api_key_enc: string | null;
  enabled: boolean;
  analyze_new_email: boolean;
};

type EmailMessage = {
  provider_message_id: string;
  direction: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string[] | null;
  subject: string | null;
  summary: string | null;
  body_text: string | null;
  received_at: string | null;
  sent_at: string | null;
  created_at: string;
};

type ThreadRow = {
  id: string;
  subject: string | null;
  contact_id: string | null;
  company_id: string | null;
};

type Analysis = {
  summary: string | null;
  next_action: string | null;
  needs_reply: boolean;
  suggested_to: string | null;
  suggested_subject: string | null;
  suggested_body: string | null;
  rationale: string | null;
  contact_name: string | null;
  contact_job_title: string | null;
  contact_phone: string | null;
  company_name: string | null;
};

function outputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks: string[] = [];
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
      if (typeof part?.text === "string" && !chunks.includes(part.text)) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseJson(text: string): Analysis {
  const clean = text.trim().replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
  const parsed = JSON.parse(clean);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() || null : null,
    next_action: typeof parsed.next_action === "string" ? parsed.next_action.trim() || null : null,
    needs_reply: Boolean(parsed.needs_reply),
    suggested_to: typeof parsed.suggested_to === "string" ? parsed.suggested_to.trim() || null : null,
    suggested_subject: typeof parsed.suggested_subject === "string" ? parsed.suggested_subject.trim() || null : null,
    suggested_body: typeof parsed.suggested_body === "string" ? parsed.suggested_body.trim() || null : null,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim() || null : null,
    contact_name: typeof parsed.contact_name === "string" ? parsed.contact_name.trim() || null : null,
    contact_job_title: typeof parsed.contact_job_title === "string" ? parsed.contact_job_title.trim() || null : null,
    contact_phone: typeof parsed.contact_phone === "string" ? parsed.contact_phone.trim() || null : null,
    company_name: typeof parsed.company_name === "string" ? parsed.company_name.trim() || null : null,
  };
}

function messageTime(row: EmailMessage) {
  return new Date(row.received_at || row.sent_at || row.created_at).getTime();
}

function transcript(messages: EmailMessage[]) {
  return messages
    .slice(-12)
    .map((m) => {
      const body = (m.body_text || m.summary || "").trim().slice(0, 6000);
      const to = (m.to_addresses || []).join(", ");
      return [
        `[${m.direction || "message"}]`,
        `From: ${m.from_name ? m.from_name + " <" + (m.from_address || "") + ">" : (m.from_address || "unknown")}`,
        `To: ${to || "unknown"}`,
        `Subject: ${m.subject || "(no subject)"}`,
        body || "(no body available)",
      ].join("\n");
    })
    .join("\n\n---\n\n")
    .slice(-30000);
}

async function enrichLinkedRecords(
  supabase: SupabaseClient,
  thread: ThreadRow,
  analysis: Analysis,
) {
  if (thread.contact_id) {
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("id,display_name,job_title,phone")
      .eq("id", thread.contact_id)
      .maybeSingle();

    if (contact) {
      const patch: Record<string, string> = {};
      if (!contact.display_name && analysis.contact_name) patch.display_name = analysis.contact_name;
      if (!contact.job_title && analysis.contact_job_title) patch.job_title = analysis.contact_job_title;
      if (!contact.phone && analysis.contact_phone) patch.phone = analysis.contact_phone;
      if (Object.keys(patch).length) {
        await supabase
          .from("crm_contacts")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", thread.contact_id);
      }
    }
  }

  if (thread.company_id && analysis.company_name) {
    const { data: company } = await supabase
      .from("crm_companies")
      .select("id,name,source,domain")
      .eq("id", thread.company_id)
      .maybeSingle();

    if (company?.source === "email" && company.domain) {
      const derived = String(company.domain)
        .split(".")[0]
        .split(/[-_]/)
        .filter(Boolean)
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      if (company.name === derived && analysis.company_name !== company.name) {
        await supabase
          .from("crm_companies")
          .update({ name: analysis.company_name, updated_at: new Date().toISOString() })
          .eq("id", thread.company_id);
      }
    }
  }
}

export async function analyzeEmailThreadIfChanged(
  supabase: SupabaseClient,
  organisationId: string,
  threadId: string,
) {
  const { data: settings, error: settingsError } = await supabase
    .from("crm_ai_settings")
    .select("model,api_key_enc,enabled,analyze_new_email")
    .eq("organisation_id", organisationId)
    .maybeSingle<AiSettings>();

  if (settingsError || !settings?.enabled || !settings.analyze_new_email || !settings.api_key_enc) {
    return { analyzed: false, reason: "disabled_or_unconfigured" };
  }

  const [{ data: thread, error: threadError }, { data: rawMessages, error: messageError }] = await Promise.all([
    supabase
      .from("crm_email_threads")
      .select("id,subject,contact_id,company_id")
      .eq("organisation_id", organisationId)
      .eq("id", threadId)
      .maybeSingle<ThreadRow>(),
    supabase
      .from("crm_emails")
      .select("provider_message_id,direction,from_address,from_name,to_addresses,subject,summary,body_text,received_at,sent_at,created_at")
      .eq("organisation_id", organisationId)
      .eq("thread_id", threadId),
  ]);

  if (threadError || messageError || !thread || !rawMessages?.length) {
    return { analyzed: false, reason: "thread_unavailable" };
  }

  const messages = (rawMessages as EmailMessage[]).sort((a, b) => messageTime(a) - messageTime(b));
  const latest = messages.at(-1)!;

  const { data: existing } = await supabase
    .from("crm_email_thread_ai")
    .select("last_message_id")
    .eq("organisation_id", organisationId)
    .eq("thread_id", threadId)
    .maybeSingle();

  if (existing?.last_message_id === latest.provider_message_id) {
    return { analyzed: false, reason: "already_current" };
  }

  const apiKey = await decryptSecret(settings.api_key_enc);
  if (!apiKey) return { analyzed: false, reason: "api_key_unavailable" };

  const system = [
    "You analyze B2B/business email conversations for a CRM.",
    "Return ONLY valid JSON, no markdown.",
    "Never invent facts. Only extract a name, title, phone, or company when explicitly present in the email text/signature.",
    "Decide whether a reply is genuinely needed. If not, set needs_reply false and suggested fields null.",
    "Keep the summary concise but useful for a salesperson or operator.",
    "next_action must be a specific recommended action, not generic advice.",
    "If a reply is needed, write a concise professional suggested reply that responds to the latest inbound message and preserves the conversation context.",
    "JSON keys exactly: summary,next_action,needs_reply,suggested_to,suggested_subject,suggested_body,rationale,contact_name,contact_job_title,contact_phone,company_name.",
  ].join(" ");

  const user = [
    `Thread subject: ${thread.subject || "(no subject)"}`,
    "",
    transcript(messages),
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model || "gpt-6-luna",
        input: [
          { role: "system", content: [{ type: "input_text", text: system }] },
          { role: "user", content: [{ type: "input_text", text: user }] },
        ],
        max_output_tokens: 1200,
        store: false,
      }),
      cache: "no-store",
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || "OpenAI analysis request failed");
    }

    const text = outputText(payload);
    if (!text) throw new Error("OpenAI returned no analysis text");
    const analysis = parseJson(text);

    if (analysis.needs_reply && !analysis.suggested_to) {
      const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound" && m.from_address);
      analysis.suggested_to = lastInbound?.from_address || null;
    }
    if (analysis.needs_reply && !analysis.suggested_subject) {
      const subject = latest.subject || thread.subject || "";
      analysis.suggested_subject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
    }

    const { error: saveError } = await supabase
      .from("crm_email_thread_ai")
      .upsert({
        organisation_id: organisationId,
        thread_id: threadId,
        last_message_id: latest.provider_message_id,
        summary: analysis.summary,
        next_action: analysis.next_action,
        needs_reply: analysis.needs_reply,
        suggested_to: analysis.suggested_to,
        suggested_subject: analysis.suggested_subject,
        suggested_body: analysis.suggested_body,
        rationale: analysis.rationale,
        contact_name: analysis.contact_name,
        contact_job_title: analysis.contact_job_title,
        contact_phone: analysis.contact_phone,
        company_name: analysis.company_name,
        model: settings.model || "gpt-6-luna",
        status: "ready",
        error: null,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "organisation_id,thread_id" });

    if (saveError) throw saveError;
    await enrichLinkedRecords(supabase, thread, analysis);

    return { analyzed: true, analysis };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed";
    await supabase
      .from("crm_email_thread_ai")
      .upsert({
        organisation_id: organisationId,
        thread_id: threadId,
        last_message_id: latest.provider_message_id,
        status: "error",
        error: message,
        model: settings.model || "gpt-6-luna",
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "organisation_id,thread_id" });
    return { analyzed: false, reason: "error", error: message };
  }
}
