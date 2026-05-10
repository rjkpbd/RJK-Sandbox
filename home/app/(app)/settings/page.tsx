import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/constants";
import UsersManager from "./UsersManager";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin =
    user?.email === ADMIN_EMAIL || user?.app_metadata?.role === "admin";

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    "";
  const picture = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your account.</p>
      </div>

      {/* Account section */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Account</h2>
        <div className="flex items-center gap-4 mb-6">
          {picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picture}
              alt={displayName}
              width={40}
              height={40}
              className="rounded-full"
            />
          )}
          <div>
            <p className="text-white font-medium text-sm">{displayName}</p>
            <p className="text-slate-400 text-xs">{user?.email}</p>
            {isAdmin && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-indigo-600/30 text-indigo-300 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Log out
          </button>
        </form>
      </div>

      {/* Admin section */}
      {isAdmin && <UsersManager />}
    </div>
  );
}
