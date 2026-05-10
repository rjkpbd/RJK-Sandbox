"use client";

import { useEffect, useState } from "react";
import { HardDrive, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuotaInfo {
  pct: number;
  usedMB: number;
  quotaMB: number;
}

export function StorageQuotaBanner() {
  const [info, setInfo] = useState<QuotaInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!navigator?.storage?.estimate) return;
    navigator.storage.estimate().then((est) => {
      if (!est.usage || !est.quota) return;
      const pct = est.usage / est.quota;
      if (pct < 0.7) return;
      setInfo({
        pct,
        usedMB: Math.round(est.usage / 1_048_576),
        quotaMB: Math.round(est.quota / 1_048_576),
      });
    });
  }, []);

  if (!info || dismissed) return null;

  const isCritical = info.pct >= 0.9;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 max-w-sm flex items-start gap-3 rounded-xl px-4 py-3 border shadow-xl",
      isCritical
        ? "bg-slate-900 border-red-500/40"
        : "bg-slate-900 border-amber-500/40"
    )}>
      <HardDrive size={14} className={cn("shrink-0 mt-0.5", isCritical ? "text-red-400" : "text-amber-400")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium", isCritical ? "text-red-300" : "text-amber-300")}>
          Storage {Math.round(info.pct * 100)}% full
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {info.usedMB} MB used of {info.quotaMB} MB.{" "}
          {isCritical
            ? "Export and delete old conversations immediately."
            : "Consider exporting older conversations."}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        title="Dismiss"
        aria-label="Dismiss storage warning"
        className={cn("p-0.5 shrink-0 transition-colors", isCritical ? "text-red-500 hover:text-red-300" : "text-amber-500 hover:text-amber-300")}
      >
        <X size={13} />
      </button>
    </div>
  );
}
