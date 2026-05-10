import { Suspense } from "react";
import SummaryDashboard from "@/components/modules/kosterina-billing/SummaryDashboard";

export default function SummaryPage() {
  return (
    <Suspense>
      <SummaryDashboard />
    </Suspense>
  );
}
