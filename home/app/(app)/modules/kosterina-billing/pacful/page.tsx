import { Suspense } from "react";
import PacfulTable from "@/components/modules/kosterina-billing/PacfulTable";

export default function PacfulPage() {
  return (
    <Suspense>
      <PacfulTable />
    </Suspense>
  );
}
