import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const authBase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [`${authBase}/auth/v1`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["email", "profile"],
  });
}
