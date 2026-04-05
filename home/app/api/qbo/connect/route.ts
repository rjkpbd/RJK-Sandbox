import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/quickbooks";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("qbo_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getAuthorizationUrl(state));
}
