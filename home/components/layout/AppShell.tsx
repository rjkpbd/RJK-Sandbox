"use client";

import { useState } from "react";
import { Menu, Boxes } from "lucide-react";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-slate-950 text-slate-100">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        isAdmin={isAdmin}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-4 h-12 bg-slate-900 border-b border-slate-700 shrink-0 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Boxes size={18} className="text-indigo-400 shrink-0" />
          <span className="text-white font-semibold text-sm">RJK Sandbox</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
