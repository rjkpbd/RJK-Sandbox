"use client";

import { useState, useCallback } from "react";
import { Globe, FolderOpen, MessageSquare, Settings2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateConversation } from "@/lib/claude-inbox/data/conversations";
import { GlobalInstructionsModal } from "./global-instructions-modal";
import type { Project } from "@/lib/claude-inbox/sync/types";

interface InstructionsPanelProps {
  conversationId: string;
  userId: string;
  globalInstructions: string | null | undefined;
  project: Project | undefined;
  conversationInstructions: string | null | undefined;
}

function LayerRow({
  icon,
  label,
  text,
  placeholder,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  text: string | null | undefined;
  placeholder: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex items-center gap-1.5 w-28 shrink-0 mt-0.5">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("flex-1 text-xs leading-relaxed", text?.trim() ? "text-slate-300" : "text-slate-600 italic")}>
        {text?.trim() || placeholder}
      </p>
      {action && <div className="shrink-0 mt-0.5">{action}</div>}
    </div>
  );
}

export function InstructionsPanel({
  conversationId,
  userId,
  globalInstructions,
  project,
  conversationInstructions,
}: InstructionsPanelProps) {
  const [open, setOpen] = useState(false);
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [editingConv, setEditingConv] = useState(false);
  const [convValue, setConvValue] = useState(conversationInstructions ?? "");

  const hasAny =
    (globalInstructions?.trim() ?? "") ||
    (project?.system_prompt?.trim() ?? "") ||
    (conversationInstructions?.trim() ?? "");

  const handleSaveConv = useCallback(async () => {
    await updateConversation(conversationId, {
      system_prompt: convValue.trim() || null,
    });
    setEditingConv(false);
  }, [conversationId, convValue]);

  return (
    <div className="shrink-0">
      {/* Toggle trigger — sits in the border-bottom header area */}
      <div className="flex justify-end px-5 py-1.5 border-b border-slate-700">
        <button
          onClick={() => setOpen((v) => !v)}
          title="Custom instructions"
          aria-label="Toggle custom instructions"
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
            hasAny
              ? open ? "text-indigo-400 bg-slate-700" : "text-indigo-400 hover:bg-slate-700"
              : open ? "text-slate-400 bg-slate-700" : "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
          )}
        >
          <Settings2 size={12} />
          Instructions
          {hasAny && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
        </button>
      </div>

      {/* Expandable body */}
      {open && (
        <div className="border-b border-slate-700 bg-slate-800/40 px-5 py-3 flex flex-col gap-0 divide-y divide-slate-700/50">
          <LayerRow
            icon={<Globe size={12} />}
            label="Global"
            text={globalInstructions}
            placeholder="No global instructions"
            action={
              <button
                onClick={() => setShowGlobalModal(true)}
                title="Edit global instructions"
                className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Pencil size={11} />
              </button>
            }
          />

          <LayerRow
            icon={<FolderOpen size={12} />}
            label={project?.name ?? "Project"}
            text={project?.system_prompt}
            placeholder={project ? "No project instructions" : "No project assigned"}
          />

          {/* Conversation layer — inline editable */}
          <div className="flex items-start gap-3 py-2 last:pb-0">
            <div className="flex items-center gap-1.5 w-28 shrink-0 mt-0.5">
              <span className="text-slate-500"><MessageSquare size={12} /></span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">This chat</span>
            </div>
            <div className="flex-1">
              {editingConv ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={convValue}
                    onChange={(e) => setConvValue(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Instructions for this conversation only…"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 resize-none leading-relaxed transition-colors"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingConv(false);
                        setConvValue(conversationInstructions ?? "");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveConv}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-xs leading-relaxed", conversationInstructions?.trim() ? "text-slate-300" : "text-slate-600 italic")}>
                    {conversationInstructions?.trim() || "No conversation instructions"}
                  </p>
                  <button
                    onClick={() => {
                      setEditingConv(true);
                      setConvValue(conversationInstructions ?? "");
                    }}
                    title="Edit conversation instructions"
                    className="shrink-0 p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGlobalModal && (
        <GlobalInstructionsModal
          userId={userId}
          current={globalInstructions ?? null}
          onClose={() => setShowGlobalModal(false)}
        />
      )}
    </div>
  );
}
