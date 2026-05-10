import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SyncProvider } from "@/lib/sync/context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: middleware handles this, but guard here too.
  // Unauthenticated users should sign in via the sandbox home site.
  if (!user) {
    const homeUrl =
      process.env.NEXT_PUBLIC_HOME_URL ?? "http://localhost:3000";
    redirect(`${homeUrl}/login`);
  }

  return (
    <SyncProvider userId={user.id}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Full three-pane layout replaces this shell in Step 6 */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </SyncProvider>
  );
}
