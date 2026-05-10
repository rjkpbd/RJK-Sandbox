"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Boxes, X } from "lucide-react";
import SidebarLink from "./SidebarLink";
import moduleRegistry from "@/lib/moduleRegistry";

interface SidebarProps {
  isAdmin: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ isAdmin, mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        flex flex-col bg-slate-900 border-r border-slate-700 transition-all duration-200
        fixed inset-y-0 left-0 z-50
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:inset-auto md:translate-x-0
        w-56 ${collapsed ? "md:w-16" : ""}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-5 border-b border-slate-700 ${collapsed ? "md:justify-center md:px-0" : ""}`}>
        <Boxes size={22} className="text-indigo-400 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-white font-semibold text-sm tracking-wide">RJK Sandbox</span>
            <button
              onClick={onMobileClose}
              className="md:hidden p-1 rounded text-slate-400 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </>
        )}
        {collapsed && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1 rounded text-slate-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {isAdmin ? (
          <SidebarLink href="/admin" icon="LayoutDashboard" label="Dashboard" collapsed={collapsed} onClick={onMobileClose} />
        ) : (
          <SidebarLink href="/dashboard" icon="LayoutDashboard" label="Dashboard" collapsed={collapsed} onClick={onMobileClose} />
        )}

        {moduleRegistry.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Modules
              </p>
            )}
            {collapsed && <div className="border-t border-slate-700 my-2" />}
            {moduleRegistry.map((mod) => (
              <SidebarLink
                key={mod.id}
                href={mod.href}
                icon={mod.icon}
                label={mod.label}
                collapsed={collapsed}
                onClick={onMobileClose}
              />
            ))}
          </>
        )}
      </nav>

      {/* Bottom links */}
      <div className="px-2 py-2 border-t border-slate-700 space-y-1">
        <SidebarLink href="/settings" icon="Settings" label="Settings" collapsed={collapsed} onClick={onMobileClose} />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden md:flex items-center gap-2 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm ${collapsed ? "justify-center" : ""}`}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
