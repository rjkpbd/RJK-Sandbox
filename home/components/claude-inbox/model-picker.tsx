"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { MODELS } from "@/lib/claude-inbox/config/models";
import { updateConversation } from "@/lib/claude-inbox/data/conversations";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
  conversationId: string;
  currentModel: string;
}

export function ModelPicker({ conversationId, currentModel }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const model = MODELS.find((m) => m.id === currentModel) ?? MODELS[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectModel(id: string) {
    updateConversation(conversationId, { model: id });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change model"
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700 px-2 py-1 rounded-md transition-colors"
      >
        <span className="hidden sm:inline max-w-[110px] truncate">{model.displayName}</span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Select model</p>
          </div>
          <ul className="py-1">
            {MODELS.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => selectModel(m.id)}
                  className={cn(
                    "w-full flex flex-col px-3 py-2.5 hover:bg-slate-700/60 transition-colors text-left gap-0.5",
                    m.id === currentModel ? "bg-slate-700/30" : ""
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-medium", m.id === currentModel ? "text-indigo-300" : "text-slate-200")}>
                      {m.displayName}
                    </span>
                    {m.id === currentModel && (
                      <span className="text-[10px] text-indigo-400">current</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">{m.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
