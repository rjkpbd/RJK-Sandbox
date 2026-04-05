import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, cookieOptions } from "@/lib/session";
import { createServerClient } from "@/lib/supabase-server";
import { ADMIN_EMAIL } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("oauth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { access_token } = await tokenRes.json();

  // Fetch user info from Google
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { sub, email, name, picture } = await userRes.json();

  // Determine role — admin is hardcoded, others must be in SB-users
  let role: "admin" | "user" | null = null;

  if (email === ADMIN_EMAIL) {
    role = "admin";
  } else {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("SB-users")
      .select("email")
      .eq("email", email)
      .single();
    if (data) role = "user";
  }

  // Not authorized — redirect to google.com
  if (!role) {
    return NextResponse.redirect("https://www.google.com");
  }

  const sessionToken = await createSessionToken({ sub, email, name, picture, role });
  const destination = role === "admin" ? "/admin" : "/dashboard";

  const response = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.set(cookieOptions.name, sessionToken, cookieOptions);
  response.cookies.delete("oauth_state");

  return response;
}
