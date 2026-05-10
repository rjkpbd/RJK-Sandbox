import { createClient, createAdminClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("SB-users")
    .select("id, email, name")
    .order("created_at", { ascending: false });

  const userCount = users?.length ?? 0;
  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    "Admin";

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Welcome back, {displayName}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Registered Users</p>
          <p className="text-3xl font-bold text-white">{userCount}</p>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Users</h2>
        {userCount === 0 ? (
          <p className="text-slate-500 text-sm">No users yet. Add them from <a href="/settings" className="text-indigo-400 hover:underline">Settings</a>.</p>
        ) : (
          <ul className="space-y-2">
            {users!.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm min-w-0">
                <span className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </span>
                <span className="text-white shrink-0">{u.name ?? "—"}</span>
                <span className="text-slate-400 truncate">{u.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
