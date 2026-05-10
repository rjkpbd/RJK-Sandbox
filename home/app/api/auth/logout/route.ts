import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST() {
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

  await supabase.auth.signOut();

  const response = NextResponse.redirect(`${appUrl}/login`);
  // Apply any cookie changes from signOut (clears session tokens)
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  // Belt-and-suspenders: delete any remaining sb- cookies
  cookieStore
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .forEach((c) => response.cookies.delete(c.name));

  return response;
}
