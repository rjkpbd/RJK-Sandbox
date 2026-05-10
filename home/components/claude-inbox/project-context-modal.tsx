"use client";

import { useState, useRef } from "react";
import { X, Upload, Trash2, FileText } from "lucide-react";
import type { Project } from "@/lib/claude-inbox/sync/types";
import { updateProject } from "@/lib/claude-inbox/data/projects";

interface ProjectContextModalProps {
  project: Project;
  onClose: () => void;
}

const COMPACT_THRESHOLD = 50_000;

export function ProjectContextModal({ project, onClose }: ProjectContextModalProps) {
  const [context, setContext] = useState(project.project_context ?? "");
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProject(project.id, { project_context: context.trim() || null });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      setFileError("Only .md and .txt files are supported.");
      return;
    }

    const text = await file.text();
    setContext((prev) => {
      const header = `\n\n---\n\n## ${file.name}\n\n`;
      return prev ? `${prev}${header}${text}` : `## ${file.name}\n\n${text}`;
    });
    // Reset input so the same file can be uploaded again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const charCount = context.length;
  const nearLimit = charCount > COMPACT_THRESHOLD * 0.8;
  const overLimit = charCount > COMPACT_THRESHOLD;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Project Context</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Shared knowledge base injected into every conversation in <span className="text-slate-300">{project.name}</span>.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden px-5 py-4 gap-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Upload size={12} />
              Upload file (.md, .txt)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            {fileError && <p className="text-xs text-red-400">{fileError}</p>}
            <button
              type="button"
              onClick={() => { if (confirm("Clear all project context?")) setContext(""); }}
              className="ml-auto flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={"Add notes, facts, or upload files that Claude should know about every conversation in this project.\n\nThis is automatically updated as conversations progress."}
            className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors resize-none font-mono leading-relaxed min-h-0"
          />

          {/* Character count */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <FileText size={11} />
              <span className={overLimit ? "text-red-400" : nearLimit ? "text-amber-400" : ""}>
                {charCount.toLocaleString()} / {COMPACT_THRESHOLD.toLocaleString()} chars
              </span>
              {overLimit && <span className="text-red-400">(will be compacted on next save via AI)</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save context"}
          </button>
        </div>
      </div>
    </div>
  );
}
