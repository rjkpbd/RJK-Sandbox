import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifySessionToken(token) : null;
  const isAdmin = user?.role === "admin";

  return <AppShell isAdmin={isAdmin}>{children}</AppShell>;
}
