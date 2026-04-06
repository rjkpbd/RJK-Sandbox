import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await verifySessionToken(token);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jar = await cookies();
  const isSandbox = process.env.QUICKBOOKS_SANDBOX === "true";

  return NextResponse.json({
    sandbox_env_value: process.env.QUICKBOOKS_SANDBOX,
    is_sandbox: isSandbox,
    base_url: isSandbox
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com",
    redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI,
    client_id_prefix: process.env.QUICKBOOKS_CLIENT_ID
      ? process.env.QUICKBOOKS_CLIENT_ID.slice(0, 8) + "…"
      : null,
    has_access_token: jar.has("qbo_access_token"),
    has_refresh_token: jar.has("qbo_refresh_token"),
    has_realm_id: jar.has("qbo_realm_id"),
  });
}
