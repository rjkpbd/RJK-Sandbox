"use client";

import { Loader2, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { getModel } from "@/lib/claude-inbox/config/models";

interface ContextBarProps {
  tokensUsed: number;
  model: string;
  isCompacting: boolean;
  onCompact: () => void;
}

export function ContextBar({ tokensUsed, model, isCompacting, onCompact }: ContextBarProps) {
  const limit = getModel(model)?.contextWindow ?? 200_000;
  const pct = Math.min(tokensUsed / limit, 1);

  if (tokensUsed === 0) return null;

  const barColor =
    pct >= 0.8 ? "bg-red-500" : pct >= 0.6 ? "bg-amber-500" : "bg-slate-500";
  const textColor =
    pct >= 0.8 ? "text-red-400" : pct >= 0.6 ? "text-amber-400" : "text-slate-500";
  const showCompact = pct >= 0.3;

  return (
    <div className="flex items-center gap-2.5 px-5 py-1.5 border-b border-slate-700 shrink-0 bg-slate-900">
      {/* Fill bar */}
      <div className="flex-1 h-[3px] bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      {/* Label */}
      <span
        className={cn("text-[10px] shrink-0 tabular-nums", textColor)}
        title={`${tokensUsed.toLocaleString()} of ${limit.toLocaleString()} context tokens used`}
      >
        {Math.round(tokensUsed / 1000)}k&thinsp;/&thinsp;{Math.round(limit / 1000)}k ctx
        {pct >= 0.5 && <> · {Math.round(pct * 100)}%</>}
      </span>

      {/* Compact button — shown when ≥ 30% full */}
      {showCompact && (
        <button
          onClick={onCompact}
          disabled={isCompacting}
          title="Compact: summarize conversation to free context space"
          aria-label="Compact conversation"
          className={cn(
            "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors disabled:opacity-40 shrink-0",
            pct >= 0.8
              ? "text-red-400 hover:text-red-300 hover:bg-slate-700"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
          )}
        >
          {isCompacting ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Scissors size={10} />
          )}
          {isCompacting ? "Compacting…" : "Compact"}
        </button>
      )}
    </div>
  );
}
