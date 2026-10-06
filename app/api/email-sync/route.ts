import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation_id,role,status")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (
      !profile?.organisation_id ||
      profile.status !== "active" ||
      !["admin", "manager"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const secret = process.env.EMAIL_SYNC_BRIDGE_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!secret || !supabaseUrl) {
      return NextResponse.json({ error: "Email sync is not configured" }, { status: 500 });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/zoho-email-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, organisation_id: profile.organisation_id, source: "manual" }),
      cache: "no-store",
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email sync failed" },
      { status: 500 },
    );
  }
}
