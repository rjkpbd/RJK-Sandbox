"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

type AnyIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

interface SidebarLinkProps {
  href: string;
  icon: string;
  label: string;
  collapsed: boolean;
}

export default function SidebarLink({ href, icon, label, collapsed }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  const IconComponent = ((Icons as unknown) as Record<string, AnyIcon>)[icon] ?? Icons.Circle;

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${isActive
          ? "bg-indigo-600 text-white"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }
        ${collapsed ? "justify-center" : ""}
      `}
    >
      <IconComponent size={18} className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
