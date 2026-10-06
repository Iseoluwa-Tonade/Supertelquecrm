import { NextResponse } from "next/server";

const authServer = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`
  : "";

export async function GET() {
  return NextResponse.json(
    {
      resource: "https://crm.supertelque.com/api/mcp",
      authorization_servers: authServer ? [authServer] : [],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_name: "Supertelque CRM MCP",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
