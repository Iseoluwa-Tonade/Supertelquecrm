type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: unknown;
};

export type McpSession = {
  sessionId?: string;
  protocolVersion?: string;
};

function parseSse(text: string) {
  const events = text
    .split(/\n\n+/)
    .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
    .filter(Boolean)
    .map((line) => JSON.parse((line as string).slice(5).trim()));
  return events.at(-1);
}

export async function rawMcpRequest(
  serverUrl: string,
  body: JsonRpcRequest,
  accessToken?: string | null,
  session?: McpSession,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (session?.sessionId) headers["Mcp-Session-Id"] = session.sessionId;
  if (session?.protocolVersion) headers["MCP-Protocol-Version"] = session.protocolVersion;

  const response = await fetch(serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let payload: any = null;
  if (text) {
    if (contentType.includes("text/event-stream")) {
      try {
        payload = parseSse(text);
      } catch {
        payload = null;
      }
    } else {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
  }

  return {
    response,
    payload,
    sessionId: response.headers.get("mcp-session-id") || session?.sessionId,
  };
}

export async function initializeMcp(serverUrl: string, accessToken?: string | null) {
  const result = await rawMcpRequest(
    serverUrl,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "Supertelque CRM", version: "1.0.0" },
      },
    },
    accessToken,
  );

  if (!result.response.ok || result.payload?.error) {
    throw new Error(result.payload?.error?.message || `MCP initialize failed (${result.response.status})`);
  }

  const session: McpSession = {
    sessionId: result.sessionId || undefined,
    protocolVersion: result.payload?.result?.protocolVersion || "2025-06-18",
  };

  await rawMcpRequest(
    serverUrl,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    accessToken,
    session,
  ).catch(() => null);

  return session;
}

export async function listRemoteTools(serverUrl: string, accessToken?: string | null) {
  const session = await initializeMcp(serverUrl, accessToken);
  const result = await rawMcpRequest(
    serverUrl,
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    accessToken,
    session,
  );
  if (!result.response.ok || result.payload?.error) {
    throw new Error(result.payload?.error?.message || `MCP tools/list failed (${result.response.status})`);
  }
  return { tools: result.payload?.result?.tools || [], session };
}

export async function callRemoteTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  accessToken?: string | null,
) {
  const session = await initializeMcp(serverUrl, accessToken);
  const result = await rawMcpRequest(
    serverUrl,
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: toolName, arguments: args || {} },
    },
    accessToken,
    session,
  );
  if (!result.response.ok || result.payload?.error) {
    throw new Error(result.payload?.error?.message || `MCP tool call failed (${result.response.status})`);
  }
  return result.payload?.result;
}

export async function discoverOAuth(serverUrl: string) {
  const probe = await rawMcpRequest(serverUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "Supertelque CRM", version: "1.0.0" },
    },
  });

  if (probe.response.ok) {
    return { authType: "none" as const };
  }

  const challenge = probe.response.headers.get("www-authenticate") || "";
  const match = challenge.match(/resource_metadata="([^"]+)"/i);
  if (!match) throw new Error("MCP server did not advertise OAuth protected-resource metadata");

  const resourceMetadataUrl = match[1];
  const resourceResponse = await fetch(resourceMetadataUrl, { cache: "no-store" });
  if (!resourceResponse.ok) throw new Error("Could not read MCP protected-resource metadata");
  const resourceMetadata = await resourceResponse.json();

  const authorizationServer =
    resourceMetadata.authorization_servers?.[0] ||
    resourceMetadata.issuer;

  if (!authorizationServer) throw new Error("MCP OAuth metadata did not specify an authorization server");

  const issuer = String(authorizationServer).replace(/\/$/, "");
  const issuerUrl = new URL(issuer);
  const metadataCandidates = [
    `${issuer}/.well-known/oauth-authorization-server`,
    `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname === "/" ? "" : issuerUrl.pathname}`,
    `${issuer}/.well-known/openid-configuration`,
    `${issuerUrl.origin}/.well-known/openid-configuration${issuerUrl.pathname === "/" ? "" : issuerUrl.pathname}`,
  ];

  let authMetadata: any = null;
  let metadataError = "";
  for (const candidate of [...new Set(metadataCandidates)]) {
    try {
      const authResponse = await fetch(candidate, { cache: "no-store" });
      if (!authResponse.ok) {
        metadataError = `${candidate} returned ${authResponse.status}`;
        continue;
      }
      const candidateMetadata = await authResponse.json();
      if (candidateMetadata?.authorization_endpoint && candidateMetadata?.token_endpoint) {
        authMetadata = candidateMetadata;
        break;
      }
      metadataError = `${candidate} did not include OAuth endpoints`;
    } catch (error) {
      metadataError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!authMetadata) {
    throw new Error(`Could not read MCP authorization-server metadata${metadataError ? ": " + metadataError : ""}`);
  }

  return {
    authType: "oauth" as const,
    resourceMetadataUrl,
    resourceMetadata,
    authorizationServer,
    authMetadata,
  };
}
