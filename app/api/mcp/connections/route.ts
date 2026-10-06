import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPkcePair, encryptSecret, randomState } from "@/lib/mcp/crypto";
import { discoverOAuth, listRemoteTools } from "@/lib/mcp/client";

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

  if (!profile?.organisation_id || profile.status !== "active" || !["admin","manager"].includes(profile.role)) {
    throw new Error("Insufficient permissions");
  }

  return { supabase, user: userData.user, profile };
}

const PUBLIC_FIELDS = "id,organisation_id,name,provider,server_url,auth_type,status,resource_metadata_url,authorization_server,authorization_endpoint,token_endpoint,registration_endpoint,client_id,token_type,token_expires_at,scope,oauth_metadata,tools_cache,last_connected_at,last_error,created_at,updated_at";

export async function GET() {
  try {
    const { supabase, profile } = await getContext();
    const { data, error } = await supabase
      .from("crm_mcp_connections")
      .select(PUBLIC_FIELDS)
      .eq("organisation_id", profile.organisation_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ connections: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getContext();
    const body = await request.json();
    const provider = String(body.provider || "custom");
    const name = String(body.name || provider || "MCP connection");
    const serverUrl = String(
      body.server_url ||
      (provider === "clay" ? "https://api.clay.com/v3/mcp" : "")
    ).trim();
    const authType = String(body.auth_type || "oauth");

    if (!serverUrl || !/^https:\/\//i.test(serverUrl)) {
      return NextResponse.json({ error: "A valid HTTPS MCP server URL is required" }, { status: 400 });
    }

    const { data: connection, error: insertError } = await supabase
      .from("crm_mcp_connections")
      .upsert({
        organisation_id: profile.organisation_id,
        created_by: user.id,
        name,
        provider,
        server_url: serverUrl,
        auth_type: authType,
        status: "connecting",
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organisation_id,server_url" })
      .select("*")
      .single();

    if (insertError || !connection) throw insertError || new Error("Could not create MCP connection");

    if (authType === "none") {
      const listed = await listRemoteTools(serverUrl, null);
      await supabase.from("crm_mcp_connections").update({
        status: "connected",
        tools_cache: listed.tools,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
      return NextResponse.json({ connected: true, connection_id: connection.id, tools: listed.tools });
    }

    if (authType === "bearer") {
      if (!body.bearer_token) {
        return NextResponse.json({ error: "Bearer token is required" }, { status: 400 });
      }
      const token = String(body.bearer_token);
      const listed = await listRemoteTools(serverUrl, token);
      await supabase.from("crm_mcp_connections").update({
        access_token_enc: await encryptSecret(token),
        status: "connected",
        tools_cache: listed.tools,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
      return NextResponse.json({ connected: true, connection_id: connection.id, tools: listed.tools });
    }

    const discovery = await discoverOAuth(serverUrl);
    if (discovery.authType === "none") {
      const listed = await listRemoteTools(serverUrl, null);
      await supabase.from("crm_mcp_connections").update({
        auth_type: "none",
        status: "connected",
        tools_cache: listed.tools,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
      return NextResponse.json({ connected: true, connection_id: connection.id, tools: listed.tools });
    }

    const metadata = discovery.authMetadata;
    const registrationEndpoint = metadata.registration_endpoint;
    if (!registrationEndpoint) {
      await supabase.from("crm_mcp_connections").update({
        status: "attention",
        resource_metadata_url: discovery.resourceMetadataUrl,
        authorization_server: discovery.authorizationServer,
        authorization_endpoint: metadata.authorization_endpoint || null,
        token_endpoint: metadata.token_endpoint || null,
        oauth_metadata: metadata,
        last_error: "This MCP server does not advertise Dynamic Client Registration.",
      }).eq("id", connection.id);
      return NextResponse.json({
        error: "This MCP server requires a pre-registered OAuth client. Add the client credentials before connecting.",
        connection_id: connection.id,
      }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const redirectUri = `${origin}/api/mcp/oauth/callback`;
    const scopes = discovery.resourceMetadata?.scopes_supported || metadata.scopes_supported || ["mcp"];
    const scope = Array.isArray(scopes) ? scopes.join(" ") : String(scopes || "mcp");

    const supportedAuthMethods = Array.isArray(metadata.token_endpoint_auth_methods_supported)
      ? metadata.token_endpoint_auth_methods_supported
      : ["none"];
    const tokenEndpointAuthMethod = supportedAuthMethods.includes("client_secret_basic")
      ? "client_secret_basic"
      : supportedAuthMethods.includes("none")
        ? "none"
        : supportedAuthMethods[0];

    if (!tokenEndpointAuthMethod) {
      throw new Error("MCP OAuth server does not advertise a supported token endpoint authentication method");
    }

    const registration = await fetch(registrationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Supertelque CRM",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        token_endpoint_auth_method: tokenEndpointAuthMethod,
        scope,
      }),
      cache: "no-store",
    });

    const registered = await registration.json();
    if (!registration.ok || !registered.client_id) {
      throw new Error(registered.error_description || registered.error || "MCP OAuth client registration failed");
    }

    const pkce = await createPkcePair();
    const state = randomState();

    await supabase.from("crm_mcp_connections").update({
      resource_metadata_url: discovery.resourceMetadataUrl,
      authorization_server: discovery.authorizationServer,
      authorization_endpoint: metadata.authorization_endpoint,
      token_endpoint: metadata.token_endpoint,
      registration_endpoint: registrationEndpoint,
      client_id: registered.client_id,
      client_secret_enc: await encryptSecret(registered.client_secret || null),
      pkce_verifier_enc: await encryptSecret(pkce.verifier),
      oauth_state: state,
      scope,
      oauth_metadata: {
        protected_resource: discovery.resourceMetadata,
        authorization_server: metadata,
        registration: {
          token_endpoint_auth_method: registered.token_endpoint_auth_method || tokenEndpointAuthMethod,
        },
      },
      status: "connecting",
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id);

    const authorizationUrl = new URL(metadata.authorization_endpoint);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", registered.client_id);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", scope);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", pkce.challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    if (discovery.resourceMetadata?.resource) {
      authorizationUrl.searchParams.set("resource", discovery.resourceMetadata.resource);
    }

    return NextResponse.json({
      connected: false,
      connection_id: connection.id,
      authorization_url: authorizationUrl.toString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "MCP connection failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, profile } = await getContext();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Connection id is required" }, { status: 400 });
    const { error } = await supabase
      .from("crm_mcp_connections")
      .delete()
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
