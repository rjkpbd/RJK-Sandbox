import type { ModuleEntry } from "@/types/modules";
import PBDFinanceWidget from "@/components/modules/pbd-finance/PBDFinanceWidget";
import NotionTasksWidget from "@/components/modules/notion-tasks/NotionTasksWidget";
import ClaudeInboxWidget from "@/components/modules/claude-inbox/ClaudeInboxWidget";

// Add new modules here. The sidebar and widget grid are driven by this list.
const moduleRegistry: ModuleEntry[] = [
  {
    id: "kosterina-billing",
    label: "Kosterina Billing",
    href: "/modules/kosterina-billing",
    icon: "BarChart3",
    description: "Shipping & warehouse billing analytics (Shopify, Pacful, WWEX)",
    tags: ["billing", "shipping", "analytics", "kosterina"],
  },
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
  {
    id: "claude-inbox",
    label: "Claude Inbox",
    href: "/claude-inbox",
    icon: "Inbox",
    description: "Multi-AI conversation manager with email-style triage",
    widget: {
      component: ClaudeInboxWidget,
      size: "small",
    },
    tags: ["ai", "chat", "productivity"],
  },
];

export default moduleRegistry;
