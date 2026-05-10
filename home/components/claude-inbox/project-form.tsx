"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS } from "@/lib/claude-inbox/config/models";
import type { Project } from "@/lib/claude-inbox/sync/types";

const PROJECT_COLORS = [
  { label: "Slate", hex: "#64748b" },
  { label: "Red", hex: "#ef4444" },
  { label: "Orange", hex: "#f97316" },
  { label: "Yellow", hex: "#eab308" },
  { label: "Green", hex: "#22c55e" },
  { label: "Teal", hex: "#14b8a6" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Purple", hex: "#a855f7" },
];

interface ProjectFormProps {
  initial?: Partial<Project>;
  onSave: (data: {
    name: string;
    description: string;
    color: string;
    system_prompt: string;
    default_model: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export function ProjectForm({ initial, onSave, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[5].hex);
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? "");
  const [defaultModel, setDefaultModel] = useState(initial?.default_model ?? "");
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initial?.system_prompt || initial?.default_model)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        color,
        system_prompt: systemPrompt.trim(),
        default_model: defaultModel,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {initial?.id ? "Edit project" : "New project"}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My project"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map(({ hex, label }) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor(hex)}
                    title={label}
                    aria-label={label}
                    className={cn(
                      "w-7 h-7 rounded-full transition-transform",
                      color === hex
                        ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                        : "hover:scale-110"
                    )}
                    style={{ background: hex }}
                  />
                ))}
              </div>
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {showAdvanced ? "▾" : "▸"} Advanced settings
            </button>

            {showAdvanced && (
              <>
                {/* Default model */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Default model
                  </label>
                  <select
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">Inherit from settings</option>
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* System prompt */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    System prompt
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Instructions applied to every conversation in this project…"
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-700 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : initial?.id ? "Save changes" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
