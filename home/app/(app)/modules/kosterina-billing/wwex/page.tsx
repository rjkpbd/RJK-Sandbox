import { Suspense } from "react";
import WwexTable from "@/components/modules/kosterina-billing/WwexTable";

export default function WwexPage() {
  return (
    <Suspense>
      <WwexTable />
    </Suspense>
  );
}
