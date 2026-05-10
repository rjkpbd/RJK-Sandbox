import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validate";

export const dynamic = "force-dynamic";

const ExchangeBodySchema = z.object({
  tokenUrl: z.string().url("tokenUrl must be a valid URL"),
  code: z.string().min(1, "code is required"),
  redirectUri: z.string().url("redirectUri must be a valid URL"),
  clientId: z.string().min(1, "clientId is required"),
  codeVerifier: z.string().min(1, "codeVerifier is required"),
});

/**
 * Server-side token exchange to avoid CORS issues when calling the MCP
 * server's token endpoint from the browser.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, ExchangeBodySchema);
  if (!parsed.ok) return parsed.response;

  const { tokenUrl, code, redirectUri, clientId, codeVerifier } = parsed.data;

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? "Token exchange failed" }, { status: res.status });
    }

    return NextResponse.json({
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string) ?? null,
      expires_in: (data.expires_in as number) ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
