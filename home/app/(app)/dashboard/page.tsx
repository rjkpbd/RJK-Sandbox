import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import WidgetGrid from "@/components/dashboard/WidgetGrid";

export default async function UserDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifySessionToken(token) : null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Welcome, {user?.name ?? "there"}.
        </p>
      </div>
      <WidgetGrid />
    </div>
  );
}
