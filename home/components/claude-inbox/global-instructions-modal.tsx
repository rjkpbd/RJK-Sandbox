"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { updateUserSettings } from "@/lib/claude-inbox/data/user-settings";

interface GlobalInstructionsModalProps {
  userId: string;
  current: string | null;
  onClose: () => void;
}

export function GlobalInstructionsModal({
  userId,
  current,
  onClose,
}: GlobalInstructionsModalProps) {
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSave() {
    setSaving(true);
    await updateUserSettings(userId, { custom_instructions: value.trim() || null });
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-sm font-semibold text-white">Global custom instructions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Applied to every conversation across all projects.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={10}
            placeholder="E.g. Always respond in concise bullet points. Prefer TypeScript over JavaScript."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 resize-none leading-relaxed transition-colors"
          />
          <p className="text-xs text-slate-600 mt-2">
            These instructions appear at the top of the system prompt, before any project or conversation instructions.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
