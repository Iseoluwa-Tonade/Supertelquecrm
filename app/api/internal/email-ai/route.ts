import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/lib/mcp/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function parseJson(text: string) {
  const clean = text.trim().replace(/^\`\`\`json\s*/i, "").replace(/\`\`\`$/i, "").trim();
  return JSON.parse(clean);
}

export async function POST(request: NextRequest) {
  const expected = process.env.EMAIL_SYNC_BRIDGE_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const apiKey = await decryptSecret(String(body.api_key_enc || ""));
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 400 });

    const model = String(body.model || "gpt-6-luna");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const subject = String(body.subject || "Email conversation");
    const contact = body.contact || null;
    const company = body.company || null;
    const deal = body.deal || null;

    const transcript = messages
      .slice(-30)
      .map((message: any, index: number) => {
        const direction = message.direction === "outbound" ? "US" : "CONTACT";
        const bodyText = String(message.body_text || message.summary || "").slice(0, 6000);
        return [
          `Message ${index + 1} [${direction}]`,
          `From: ${message.from_address || ""}`,
          `To: ${Array.isArray(message.to_addresses) ? message.to_addresses.join(", ") : ""}`,
          `Date: ${message.received_at || message.sent_at || ""}`,
          bodyText,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    const instructions = [
      "You are the email intelligence layer inside a B2B CRM.",
      "Analyze only the supplied email thread and CRM context.",
      "Do not invent facts, meetings, promises, prices, dates, names, or commitments.",
      "Return ONLY valid JSON with this exact shape:",
      '{"summary":"string","next_action":"string","needs_reply":true,"suggested_to":"email or null","suggested_subject":"string or null","suggested_body":"string or null","rationale":"string","contact_name":"string or null","contact_job_title":"string or null","contact_phone":"string or null","company_name":"string or null"}',
      "summary: concise current state of the conversation.",
      "next_action: a concrete next step for the CRM user.",
      "needs_reply: true only when a reply is actually useful now.",
      "If needs_reply is false, all suggested_* fields must be null.",
      "If a reply is useful, draft a natural professional reply based only on the thread.",
      "Do not add a signature unless one is already clearly present in the recent thread.",
      "Extract contact/company details only when explicitly supported by the messages.",
    ].join("\n");

    const crmContext = {
      subject,
      contact,
      company,
      deal,
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1200,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: instructions }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: `CRM context:\n${JSON.stringify(crmContext, null, 2)}\n\nEmail thread:\n${transcript}`,
            }],
          },
        ],
      }),
      cache: "no-store",
    });

    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error?.message || "OpenAI request failed" },
        { status: response.status },
      );
    }

    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error("OpenAI returned an empty response");

    const analysis = parseJson(outputText);
    return NextResponse.json({
      analysis,
      model: payload?.model || model,
      response_id: payload?.id || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email analysis failed" },
      { status: 500 },
    );
  }
}
