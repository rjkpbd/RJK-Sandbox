"use client";

import { useState } from "react";
import { Download, FileJson, CheckCircle } from "lucide-react";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import { exportFullAccount } from "@/lib/claude-inbox/export/conversation";

export default function ExportPage() {
  const { userId } = useSyncContext();
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");

  async function handleExport() {
    if (status === "busy") return;
    setStatus("busy");
    try {
      await exportFullAccount(userId);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Export data</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Download your conversations, messages, skills, and templates.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-6 max-w-xl">
        {/* Full account export */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
              <FileJson size={18} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Full account export</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Downloads a single <code className="text-slate-400 bg-slate-700 px-1 rounded">JSON</code> file
                containing all your conversations, messages, skills, templates, and settings.
                Useful as a backup or to migrate to another device.
              </p>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={status === "busy"}
            className="flex items-center justify-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors self-start"
          >
            {status === "busy" ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting…
              </>
            ) : status === "done" ? (
              <>
                <CheckCircle size={14} className="text-emerald-300" />
                Downloaded
              </>
            ) : (
              <>
                <Download size={14} />
                Download JSON
              </>
            )}
          </button>
        </div>

        {/* Per-conversation note */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            To export a single conversation as Markdown, JSON, or PDF, open the conversation and use
            the <Download size={11} className="inline-block mx-0.5 text-slate-400" /> button in the
            conversation header.
          </p>
        </div>
      </div>
    </div>
  );
}
