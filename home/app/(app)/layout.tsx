import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin =
    user?.email === ADMIN_EMAIL || user?.app_metadata?.role === "admin";

  return <AppShell isAdmin={isAdmin}>{children}</AppShell>;
}
