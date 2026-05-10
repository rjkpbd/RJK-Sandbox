import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SyncProvider } from "@/lib/claude-inbox/sync/context";

export default async function ClaudeInboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SyncProvider userId={user.id}>
      <div className="flex h-full overflow-hidden">{children}</div>
    </SyncProvider>
  );
}
