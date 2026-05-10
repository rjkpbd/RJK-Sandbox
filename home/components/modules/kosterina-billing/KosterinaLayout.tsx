"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import PeriodSelector from "./PeriodSelector";

const TABS = [
  { label: "Summary",        href: "/modules/kosterina-billing" },
  { label: "Shopify",        href: "/modules/kosterina-billing/shopify" },
  { label: "Pacful",         href: "/modules/kosterina-billing/pacful" },
  { label: "WWEX",           href: "/modules/kosterina-billing/wwex" },
  { label: "Reconciliation", href: "/modules/kosterina-billing/reconciliation" },
  { label: "Category Rules", href: "/modules/kosterina-billing/category-rules" },
];

export default function KosterinaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");
  const qs = periodId ? `?period_id=${periodId}` : "";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Kosterina Billing</h1>
          <p className="text-slate-400 text-sm mt-1">
            Shipping &amp; warehouse billing analytics
          </p>
        </div>
        <PeriodSelector />
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-slate-700">
        {TABS.map(tab => {
          const isActive =
            tab.href === "/modules/kosterina-billing"
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={`${tab.href}${qs}`}
              className={
                "px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors " +
                (isActive
                  ? "border-indigo-500 text-white font-medium"
                  : "border-transparent text-slate-400 hover:text-slate-200")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
