import { Suspense } from "react";
import KosterinaLayout from "@/components/modules/kosterina-billing/KosterinaLayout";

export const metadata = { title: "Kosterina Billing" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <KosterinaLayout>{children}</KosterinaLayout>
    </Suspense>
  );
}
