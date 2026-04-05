/**
 * Shared helper: resolves a valid QBO access token from cookies,
 * transparently refreshing if expired. Returns null if not connected.
 */
import { cookies } from "next/headers";
import { refreshAccessToken, QBOAuthError } from "@/lib/quickbooks";

export interface QBOSession {
  accessToken: string;
  realmId: string;
}

export async function getQBOSession(): Promise<QBOSession | null> {
  const cookieStore = await cookies();
  const realmId = cookieStore.get("qbo_realm_id")?.value;
  const refreshToken = cookieStore.get("qbo_refresh_token")?.value;

  if (!realmId || !refreshToken) return null;

  let accessToken = cookieStore.get("qbo_access_token")?.value;

  if (!accessToken) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;

      cookieStore.set("qbo_access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: refreshed.expires_in,
        path: "/",
      });
      // Rotate refresh token if a new one was issued
      if (refreshed.refresh_token && refreshed.refresh_token !== refreshToken) {
        cookieStore.set("qbo_refresh_token", refreshed.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: refreshed.x_refresh_token_expires_in,
          path: "/",
        });
      }
    } catch (err) {
      if (err instanceof QBOAuthError) return null;
      throw err;
    }
  }

  return { accessToken, realmId };
}
