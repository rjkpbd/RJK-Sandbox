import { Suspense } from "react";
import ReconciliationView from "@/components/modules/kosterina-billing/ReconciliationView";

export default function ReconciliationPage() {
  return (
    <Suspense>
      <ReconciliationView />
    </Suspense>
  );
}
