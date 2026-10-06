import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/mcp/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminContext() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id,organisation_id,role,status")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (
    !profile?.organisation_id ||
    profile.status !== "active" ||
    profile.role !== "admin"
  ) {
    throw new Error("Admin access required");
  }

  return { supabase, user: userData.user, profile };
}

export async function GET() {
  try {
    const { supabase, profile } = await adminContext();
    const { data, error } = await supabase
      .from("crm_ai_settings")
      .select("provider,model,enabled,analyze_new_email,api_key_enc,updated_at")
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      configured: Boolean(data?.api_key_enc),
      provider: data?.provider || "openai",
      model: data?.model || "gpt-6-luna",
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

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user, profile } = await adminContext();
    const body = await request.json();

    const model = String(body.model || "gpt-6-luna").trim();
    const enabled = body.enabled !== false;
    const analyzeNewEmail = body.analyze_new_email !== false;
    const rawKey = String(body.api_key || "").trim();

    const current = await supabase
      .from("crm_ai_settings")
      .select("api_key_enc")
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (current.error) throw current.error;

    const apiKeyEnc = rawKey
      ? await encryptSecret(rawKey)
      : current.data?.api_key_enc || null;

    if (!apiKeyEnc) {
      return NextResponse.json(
        { error: "Enter an OpenAI API key before enabling AI." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("crm_ai_settings")
      .upsert({
        organisation_id: profile.organisation_id,
        provider: "openai",
        model,
        api_key_enc: apiKeyEnc,
        enabled,
        analyze_new_email: analyzeNewEmail,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organisation_id" });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      configured: true,
      provider: "openai",
      model,
      enabled,
      analyze_new_email: analyzeNewEmail,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save AI settings" },
      { status: 400 },
    );
  }
}
