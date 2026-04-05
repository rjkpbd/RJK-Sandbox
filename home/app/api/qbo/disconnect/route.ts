import { NextRequest, NextResponse } from "next/server";
import { revokeToken } from "@/lib/quickbooks";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("qbo_refresh_token")?.value;

  if (refreshToken) {
    try {
      await revokeToken(refreshToken);
    } catch (err) {
      console.error("QBO token revocation error:", err);
      // Non-fatal — clear cookies regardless
    }
  }

  cookieStore.delete("qbo_access_token");
  cookieStore.delete("qbo_refresh_token");
  cookieStore.delete("qbo_realm_id");

  return NextResponse.redirect(new URL("/modules/pbd-finance", request.url));
}
