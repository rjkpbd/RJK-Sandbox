"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/claude-inbox/sync/types";

interface SlashPickerProps {
  templates: Template[];
  query: string;
  activeIndex: number;
  onSelect: (template: Template) => void;
  onDismiss: () => void;
}

export function SlashPicker({
  templates,
  query,
  activeIndex,
  onSelect,
  onDismiss,
}: SlashPickerProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query
    ? templates.filter((t) =>
        t.name.toLowerCase().startsWith(query.toLowerCase())
      )
    : templates;

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50"
      onMouseDown={(e) => e.preventDefault()} // don't steal focus from textarea
    >
      <div className="px-3 py-1.5 border-b border-slate-700 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Templates</span>
        <button
          onClick={onDismiss}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          Esc to close
        </button>
      </div>
      <ul ref={listRef} className="max-h-52 overflow-y-auto py-1">
        {filtered.map((t, i) => (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t)}
              className={cn(
                "w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors",
                i === activeIndex
                  ? "bg-slate-700"
                  : "hover:bg-slate-700/60"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-200">
                  <span className="text-indigo-400">/</span>
                  {t.name}
                </span>
                {t.variables.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    {t.variables.map((v) => `{{${v}}}`).join(" ")}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate leading-tight">
                {t.body.split("\n")[0] || "No content"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
