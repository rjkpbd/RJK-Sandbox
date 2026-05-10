"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, FileText, Code2, Printer, ChevronDown } from "lucide-react";
import {
  exportConversationMd,
  exportConversationJson,
  openConversationPdfWindow,
} from "@/lib/claude-inbox/export/conversation";
import type { Conversation } from "@/lib/claude-inbox/sync/types";

interface ExportMenuProps {
  conversation: Conversation;
}

export function ExportMenu({ conversation }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try { await fn(); } finally { setBusy(false); }
  }, [busy]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title="Export conversation"
        aria-label="Export conversation"
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors"
      >
        {busy ? (
          <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <Download size={13} />
        )}
        <ChevronDown size={10} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 py-1 overflow-hidden">
          <button
            onClick={() => run(() => exportConversationMd(conversation))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <FileText size={12} className="text-slate-500 shrink-0" />
            Markdown (.md)
          </button>
          <button
            onClick={() => run(() => exportConversationJson(conversation))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Code2 size={12} className="text-slate-500 shrink-0" />
            JSON
          </button>
          <button
            onClick={() => run(() => openConversationPdfWindow(conversation))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Printer size={12} className="text-slate-500 shrink-0" />
            PDF (print)
          </button>
        </div>
      )}
    </div>
  );
}
