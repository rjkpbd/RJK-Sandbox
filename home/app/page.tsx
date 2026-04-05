import WidgetGrid from "@/components/dashboard/WidgetGrid";

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Your sandbox home base.</p>
      </div>
      <WidgetGrid />
    </div>
  );
}
