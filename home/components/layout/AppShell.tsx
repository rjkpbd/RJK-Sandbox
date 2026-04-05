import Sidebar from "./Sidebar";

export default function AppShell({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
}) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
