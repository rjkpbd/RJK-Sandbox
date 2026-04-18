/**
 * Resolves a valid QBO access token.
 *
 * Priority:
 *  1. Cookie access token (still valid) → use directly
 *  2. Cookie refresh token → refresh, update cookies + Supabase
 *  3. Supabase record (different device) → refresh, set cookies + update Supabase
 *  4. Nothing → return null (not connected)
 */
import { cookies } from "next/headers";
import { refreshAccessToken, QBOAuthError } from "@/lib/quickbooks";
import { verifySessionToken } from "@/lib/session";
import { getQBORecord, upsertQBORecord } from "@/lib/qbo-store";

export interface QBOSession {
  accessToken: string;
  realmId: string;
}

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getQBOSession(): Promise<QBOSession | null> {
  const cookieStore = await cookies();

  // Fast path: both tokens in cookies
  const cookieRealmId = cookieStore.get("qbo_realm_id")?.value;
  const cookieRefresh = cookieStore.get("qbo_refresh_token")?.value;
  const cookieAccess  = cookieStore.get("qbo_access_token")?.value;

  if (cookieRealmId && cookieAccess) {
    return { accessToken: cookieAccess, realmId: cookieRealmId };
  }

  if (cookieRealmId && cookieRefresh) {
    return refreshAndStore(cookieRefresh, cookieRealmId, cookieStore, null);
  }

  // Fall back to Supabase (cross-device)
  const sessionToken = cookieStore.get("session")?.value;
  const user = sessionToken ? await verifySessionToken(sessionToken) : null;
  if (!user) return null;

  const record = await getQBORecord(user.sub);
  if (!record) return null;

  // Check the refresh token hasn't expired server-side
  if (new Date(record.refresh_token_expires_at) <= new Date()) return null;

  return refreshAndStore(record.refresh_token, record.realm_id, cookieStore, user.sub);
}

async function refreshAndStore(
  refreshToken: string,
  realmId: string,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  userId: string | null
): Promise<QBOSession | null> {
  try {
    const refreshed = await refreshAccessToken(refreshToken);

    cookieStore.set("qbo_access_token", refreshed.access_token, {
      ...COOKIE_BASE,
      maxAge: refreshed.expires_in,
    });
    cookieStore.set("qbo_realm_id", realmId, {
      ...COOKIE_BASE,
      maxAge: refreshed.x_refresh_token_expires_in,
    });

    const newRefresh = refreshed.refresh_token ?? refreshToken;
    if (newRefresh !== refreshToken) {
      cookieStore.set("qbo_refresh_token", newRefresh, {
        ...COOKIE_BASE,
        maxAge: refreshed.x_refresh_token_expires_in,
      });
    }

    // Keep Supabase in sync with the latest refresh token
    if (userId) {
      await upsertQBORecord(userId, {
        realm_id: realmId,
        refresh_token: newRefresh,
        refresh_token_expires_at: new Date(
          Date.now() + refreshed.x_refresh_token_expires_in * 1000
        ).toISOString(),
      });
    }

    return { accessToken: refreshed.access_token, realmId };
  } catch (err) {
    if (err instanceof QBOAuthError) return null;
    throw err;
  }
}
