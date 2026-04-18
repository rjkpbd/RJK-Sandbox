import { NextRequest, NextResponse } from "next/server";
import { revokeToken } from "@/lib/quickbooks";
import { verifySessionToken } from "@/lib/session";
import { deleteQBORecord } from "@/lib/qbo-store";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("qbo_refresh_token")?.value;

  if (refreshToken) {
    try {
      await revokeToken(refreshToken);
    } catch (err) {
      console.error("QBO token revocation error:", err);
      // Non-fatal — clear storage regardless
    }
  }

  cookieStore.delete("qbo_access_token");
  cookieStore.delete("qbo_refresh_token");
  cookieStore.delete("qbo_realm_id");

  // Remove from Supabase so all devices are disconnected
  const sessionToken = cookieStore.get("session")?.value;
  const user = sessionToken ? await verifySessionToken(sessionToken) : null;
  if (user) {
    await deleteQBORecord(user.sub);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  return NextResponse.redirect(new URL("/modules/pbd-finance", appUrl));
}
