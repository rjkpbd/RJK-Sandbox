import type { ModuleEntry } from "@/types/modules";
import PBDFinanceWidget from "@/components/modules/pbd-finance/PBDFinanceWidget";
import NotionTasksWidget from "@/components/modules/notion-tasks/NotionTasksWidget";

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
  {
    id: "notion-tasks",
    label: "Tasks",
    href: "/modules/notion-tasks",
    icon: "CheckSquare",
    description: "All tasks from Notion with filtering by assignee, client, status, and more",
    widget: {
      component: NotionTasksWidget,
      size: "small",
    },
    tags: ["tasks", "notion"],
  },
];

export default moduleRegistry;
