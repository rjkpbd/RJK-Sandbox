import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { ADMIN_EMAIL } from "@/lib/constants";

export async function requireAdmin(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const isAdmin = user.email === ADMIN_EMAIL || user.app_metadata?.role === "admin";
  return isAdmin ? user : null;
}
