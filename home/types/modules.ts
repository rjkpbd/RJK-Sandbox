import type { ComponentType } from "react";

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetDefinition {
  component: ComponentType;
  size: WidgetSize;
  refreshIntervalMs?: number;
}

export interface ModuleEntry {
  id: string;
  label: string;
  href: string;
  icon: string; // Lucide icon name
  description: string;
  widget?: WidgetDefinition;
  tags?: string[];
}
