import type { ModuleEntry } from "@/types/modules";
import PBDFinanceWidget from "@/components/modules/pbd-finance/PBDFinanceWidget";

// Add new modules here. The sidebar and widget grid are driven by this list.
const moduleRegistry: ModuleEntry[] = [
  {
    id: "pbd-finance",
    label: "PBD Finance",
    href: "/modules/pbd-finance",
    icon: "TrendingUp",
    description: "Income statement & accounts receivable via QuickBooks Online",
    widget: {
      component: PBDFinanceWidget,
      size: "medium",
    },
    tags: ["finance", "quickbooks"],
  },
];

export default moduleRegistry;
