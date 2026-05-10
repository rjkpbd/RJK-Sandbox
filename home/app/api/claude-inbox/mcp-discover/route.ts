import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validate";

export const dynamic = "force-dynamic";

export interface DiscoverResult {
  authorization_url: string;
  token_url: string;
  client_id: string | null;  // null if dynamic registration unavailable
  scopes_supported: string[];
  dynamic_registration: boolean;
}

const DiscoverBodySchema = z.object({
  serverUrl: z.string().url("serverUrl must be a valid URL"),
  redirectUri: z.string().url("redirectUri must be a valid URL"),
});

/**
 * Proxy for MCP OAuth discovery + optional dynamic client registration.
 * Done server-side to avoid CORS on the well-known and registration endpoints.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, DiscoverBodySchema);
  if (!parsed.ok) return parsed.response;

  const { serverUrl, redirectUri } = parsed.data;

  // Normalise: strip trailing slash
  const base = serverUrl.replace(/\/$/, "");

  // RFC 8414 §3: try path-aware URL first, then root
  const parsedUrl = new URL(base);
  const candidates = [
    `${parsedUrl.origin}/.well-known/oauth-authorization-server${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`,
    `${parsedUrl.origin}/.well-known/oauth-authorization-server`,
    `${parsedUrl.origin}/.well-known/openid-configuration`,
  ];

  let meta: Record<string, unknown> | null = null;
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const data = await r.json() as Record<string, unknown>;
        if (data.authorization_endpoint && data.token_endpoint) { meta = data; break; }
      }
    } catch {
      // try next candidate
    }
  }

  if (!meta) {
    return NextResponse.json(
      { error: "Could not discover OAuth metadata. The server may not expose /.well-known/oauth-authorization-server." },
      { status: 404 }
    );
  }

  const authorizationUrl = meta.authorization_endpoint as string;
  const tokenUrl = meta.token_endpoint as string;
  const scopesSupported = Array.isArray(meta.scopes_supported)
    ? (meta.scopes_supported as string[])
    : [];

  // Attempt dynamic client registration (RFC 7591)
  let clientId: string | null = null;
  let dynamicRegistration = false;

  const registrationEndpoint = meta.registration_endpoint as string | undefined;
  if (registrationEndpoint) {
    try {
      const regRes = await fetch(registrationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Claude Inbox",
          redirect_uris: [redirectUri],
          grant_types: ["authorization_code"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (regRes.ok) {
        const regData = await regRes.json() as Record<string, unknown>;
        if (regData.client_id) {
          clientId = regData.client_id as string;
          dynamicRegistration = true;
        }
      }
    } catch {
      // Dynamic registration failed — user will need to provide client_id manually
    }
  }

  const result: DiscoverResult = {
    authorization_url: authorizationUrl,
    token_url: tokenUrl,
    client_id: clientId,
    scopes_supported: scopesSupported,
    dynamic_registration: dynamicRegistration,
  };

  return NextResponse.json(result);
}
