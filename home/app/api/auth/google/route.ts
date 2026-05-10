import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { pendingCookies.push(...cookiesToSet); },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${appUrl}/auth/callback` },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${appUrl}/login?error=auth`);
  }

  const response = NextResponse.redirect(data.url);
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
