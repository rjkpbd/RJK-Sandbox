import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ADMIN_EMAIL } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=auth`);
  }

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

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    return NextResponse.redirect(`${appUrl}/login?error=auth`);
  }

  const { user } = session;
  const email = user.email!;

  const admin = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let role: "admin" | "user" | null = null;
  if (email === ADMIN_EMAIL) {
    role = "admin";
  } else {
    const { data } = await admin
      .from("SB-users")
      .select("email")
      .eq("email", email)
      .single();
    if (data) role = "user";
  }

  const applyAndRedirect = (destination: string) => {
    const response = NextResponse.redirect(destination);
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  };

  if (!role) {
    // Sign out the session we just created so the user isn't left in a half-authenticated state
    await admin.auth.admin.signOut(session.access_token);
    const response = NextResponse.redirect(`${appUrl}/login?error=unauthorized`);
    // Do not apply session cookies — session was invalidated above
    return response;
  }

  // Persist role in app_metadata (tamper-proof, available in all future getUser() calls)
  await admin.auth.admin.updateUserById(user.id, { app_metadata: { role } });

  return applyAndRedirect(`${appUrl}${role === "admin" ? "/admin" : "/dashboard"}`);
}
