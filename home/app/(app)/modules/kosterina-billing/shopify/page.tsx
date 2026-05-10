import { Suspense } from "react";
import ShopifyTable from "@/components/modules/kosterina-billing/ShopifyTable";

export default function ShopifyPage() {
  return (
    <Suspense>
      <ShopifyTable />
    </Suspense>
  );
}
