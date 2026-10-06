import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/mcp/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getContext() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organisation_id,role,status")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile?.organisation_id || profile.status !== "active" || profile.role !== "admin") {
    throw new Error("Only an active CRM admin can manage AI settings");
  }

  return { supabase, user: userData.user, profile };
}

export async function GET() {
  try {
    const { supabase, profile } = await getContext();
    const { data, error } = await supabase
      .from("crm_ai_settings")
      .select("provider,model,api_key_enc,enabled,analyze_new_email,updated_at")
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      provider: data?.provider || "openai",
      model: data?.model || "gpt-6-luna",
      configured: Boolean(data?.api_key_enc),
      enabled: data?.enabled ?? true,
      analyze_new_email: data?.analyze_new_email ?? true,
      updated_at: data?.updated_at || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getContext();
    const body = await request.json();
    const model = String(body.model || "gpt-6-luna").trim();
    const apiKey = String(body.api_key || "").trim();

    const { data: existing } = await supabase
      .from("crm_ai_settings")
      .select("api_key_enc")
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    const row = {
      organisation_id: profile.organisation_id,
      provider: "openai",
      model: model || "gpt-6-luna",
      api_key_enc: apiKey ? await encryptSecret(apiKey) : existing?.api_key_enc || null,
      enabled: body.enabled !== false,
      analyze_new_email: body.analyze_new_email !== false,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("crm_ai_settings")
      .upsert(row, { onConflict: "organisation_id" });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      configured: Boolean(row.api_key_enc),
      model: row.model,
      enabled: row.enabled,
      analyze_new_email: row.analyze_new_email,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save AI settings" },
      { status: 400 },
    );
  }
}
