"use client";

import { X } from "lucide-react";

export const DEFAULT_SHORTCUTS = [
  { id: "new-conversation", label: "New conversation", key: "⌘N" },
  { id: "command-palette", label: "Open command palette", key: "⌘K" },
  { id: "focus-search", label: "Focus search bar", key: "⌘/" },
  { id: "show-shortcuts", label: "Show keyboard shortcuts", key: "?" },
  { id: "send-message", label: "Send message", key: "⌘↵" },
  { id: "stop-stream", label: "Stop generation", key: "Esc" },
  { id: "clear-conversation", label: "Clear active conversation", key: "Esc" },
] as const;

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-0.5">
          {DEFAULT_SHORTCUTS.map(({ id, label, key }) => (
            <div key={id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <span className="text-sm text-slate-300">{label}</span>
              <kbd className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded font-mono shrink-0 ml-4">
                {key}
              </kbd>
            </div>
          ))}
          <p className="text-[10px] text-slate-600 mt-3">
            Reassign shortcuts in Settings → Keyboard shortcuts
          </p>
        </div>
      </div>
    </div>
  );
}
