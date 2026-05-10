"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Template } from "@/lib/claude-inbox/sync/types";

interface TemplateFormProps {
  initial?: Template;
  onSave: (data: { name: string; body: string }) => Promise<void>;
  onCancel: () => void;
}

function extractVariables(body: string): string[] {
  const vars = new Set<string>();
  for (const m of body.matchAll(/\{\{(\w+)\}\}/g)) vars.add(m[1]);
  return Array.from(vars);
}

export function TemplateForm({ initial, onSave, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const variables = extractVariables(body);
  const canSave = name.trim().length > 0 && body.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({ name: name.trim().replace(/^\/+/, ""), body: body.trim() });
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">
            {initial ? "Edit template" : "New template"}
          </h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Command name</label>
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg focus-within:border-indigo-500 transition-colors">
              <span className="px-3 text-indigo-400 font-mono text-sm select-none">/</span>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value.replace(/^\/+/, "").replace(/\s+/g, "-"))}
                placeholder="my-template"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 outline-none py-2 pr-3"
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Template body
              <span className="ml-1.5 font-normal text-slate-600">
                use {"{{variable}}"} for placeholders
              </span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder={"Translate the following text to {{language}}:\n\n{{text}}"}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 resize-none leading-relaxed transition-colors font-mono"
            />
          </div>

          {/* Variables preview */}
          {variables.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Variables:</span>
              {variables.map((v) => (
                <span
                  key={v}
                  className="text-[11px] bg-slate-700 text-indigo-300 px-2 py-0.5 rounded font-mono"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Create template"}
          </button>
        </div>
      </div>
    </div>
  );
}
