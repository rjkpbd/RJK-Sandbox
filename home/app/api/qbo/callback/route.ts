import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/quickbooks";
import { verifySessionToken } from "@/lib/session";
import { upsertQBORecord } from "@/lib/qbo-store";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const code = p.get("code");
  const realmId = p.get("realmId");
  const state = p.get("state");
  const error = p.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("qbo_oauth_state")?.value;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const redirect = (err: string) =>
    NextResponse.redirect(new URL(`/modules/pbd-finance?error=${err}`, appUrl));

  if (error) return redirect("auth_denied");
  if (!code || !realmId || !state || state !== storedState)
    return redirect("invalid_state");

  try {
    const tokens = await exchangeCodeForTokens(code);

    const base = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    cookieStore.set("qbo_access_token", tokens.access_token, {
      ...base,
      maxAge: tokens.expires_in,
    });
    cookieStore.set("qbo_refresh_token", tokens.refresh_token, {
      ...base,
      maxAge: tokens.x_refresh_token_expires_in,
    });
    cookieStore.set("qbo_realm_id", realmId, {
      ...base,
      maxAge: tokens.x_refresh_token_expires_in,
    });
    cookieStore.delete("qbo_oauth_state");

    // Persist to Supabase so connection survives across devices/sessions
    const sessionToken = cookieStore.get("session")?.value;
    const user = sessionToken ? await verifySessionToken(sessionToken) : null;
    if (user) {
      const expiresAt = new Date(
        Date.now() + tokens.x_refresh_token_expires_in * 1000
      ).toISOString();
      await upsertQBORecord(user.sub, {
        realm_id: realmId,
        refresh_token: tokens.refresh_token,
        refresh_token_expires_at: expiresAt,
      });
    }

    return NextResponse.redirect(new URL("/modules/pbd-finance", appUrl));
  } catch (err) {
    console.error("QBO callback error:", err);
    return redirect("token_exchange");
  }
}
