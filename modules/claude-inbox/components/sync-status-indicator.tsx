"use client";

import { useSyncStatus } from "@/lib/sync/context";
import { cn } from "@/lib/utils";

export function SyncStatusIndicator() {
  const { status, pendingCount, isBootstrapping, bootstrapProgress } =
    useSyncStatus();

  if (isBootstrapping) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        <span>Loading… {bootstrapProgress}%</span>
      </div>
    );
  }

  const dot = {
    idle: "bg-green-500",
    syncing: "bg-blue-500 animate-pulse",
    offline: "bg-yellow-500",
    error: "bg-red-500",
  }[status];

  const label = {
    idle: pendingCount > 0 ? `${pendingCount} pending` : "Synced",
    syncing: "Syncing…",
    offline: "Offline",
    error: "Sync error",
  }[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span>{label}</span>
    </div>
  );
}
