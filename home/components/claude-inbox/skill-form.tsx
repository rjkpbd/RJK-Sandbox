"use client";

import { useState, useEffect, useRef } from "react";
import { X, GitBranch, Loader2, Upload } from "lucide-react";
import { unzip } from "fflate";
import { fetchSkillFromGitHub } from "@/lib/claude-inbox/data/skills";
import type { Skill } from "@/lib/claude-inbox/sync/types";

interface SkillFormProps {
  initial?: Skill;
  onSave: (data: {
    name: string;
    description: string;
    body: string;
    version: string;
    allowed_tools: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function SkillForm({ initial, onSave, onCancel }: SkillFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [version, setVersion] = useState(initial?.version ?? "1.0.0");
  const [allowedTools, setAllowedTools] = useState(
    (initial?.allowed_tools ?? []).join(", ")
  );
  const [githubUrl, setGitBranchUrl] = useState(initial?.source_url ?? "");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const canSave = name.trim().length > 0 && body.trim().length > 0;

  async function handleImport() {
    if (!githubUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const content = await fetchSkillFromGitHub(githubUrl.trim());
      setBody(content);
      // Auto-fill name from URL if empty
      if (!name.trim()) {
        const segments = githubUrl.split("/");
        const filename = segments[segments.length - 1].replace(/\.\w+$/, "");
        setName(filename.replace(/[-_]/g, " "));
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    try {
      if (file.name.endsWith(".md") || file.name.endsWith(".txt")) {
        const text = await file.text();
        setBody(text);
        if (!name.trim()) setName(file.name.replace(/\.\w+$/, "").replace(/[-_]/g, " "));
      } else if (file.name.endsWith(".zip")) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        await new Promise<void>((resolve, reject) => {
          unzip(data, (err, files) => {
            if (err) { reject(err); return; }
            const mdEntries = Object.entries(files)
              .filter(([path]) => path.endsWith(".md") || path.endsWith(".txt"))
              .sort(([a], [b]) => a.localeCompare(b));
            if (mdEntries.length === 0) { reject(new Error("No .md files found in ZIP.")); return; }
            const decoder = new TextDecoder();
            const parts = mdEntries.map(([path, bytes]) =>
              mdEntries.length > 1 ? `# ${path}\n\n${decoder.decode(bytes)}` : decoder.decode(bytes)
            );
            setBody(parts.join("\n\n---\n\n"));
            if (!name.trim() && mdEntries.length === 1) {
              setName(mdEntries[0][0].replace(/.*\//, "").replace(/\.\w+$/, "").replace(/[-_]/g, " "));
            }
            resolve();
          });
        });
      } else {
        setFileError("Only .md and .zip files are supported.");
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to read file.");
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      description: description.trim(),
      body: body.trim(),
      version: version.trim() || "1.0.0",
      allowed_tools: allowedTools
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl mx-4 flex flex-col shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {initial ? "Edit skill" : "New skill"}
          </h2>
          <button onClick={onCancel} aria-label="Close" className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-5 flex flex-col gap-4">
            {/* GitHub import */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <GitBranch size={12} />
                Import from GitHub
              </label>
              <div className="flex gap-2">
                <input
                  value={githubUrl}
                  onChange={(e) => setGitBranchUrl(e.target.value)}
                  placeholder="https://github.com/user/repo/blob/main/skill.md"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={handleImport}
                  disabled={!githubUrl.trim() || importing}
                  className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 px-3 py-2 rounded-lg transition-colors shrink-0"
                >
                  {importing ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />}
                  {importing ? "Fetching…" : "Import"}
                </button>
              </div>
              {importError && <p className="text-xs text-red-400">{importError}</p>}
            </div>

            {/* File upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Upload size={12} />
                Upload file
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors"
                >
                  <Upload size={12} />
                  Choose .md or .zip…
                </button>
                <span className="text-[11px] text-slate-600">body will be populated from file contents</span>
              </div>
              {fileError && <p className="text-xs text-red-400">{fileError}</p>}
              <input ref={fileInputRef} type="file" accept=".md,.txt,.zip" onChange={handleFileUpload} className="hidden" aria-hidden />
            </div>

            <div className="border-t border-slate-700/50" />

            {/* Name + Version row */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium text-slate-400">Name</label>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My skill"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-24">
                <label className="text-xs font-medium text-slate-400">Version</label>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this skill do?"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">
                Instructions / body
                <span className="ml-1.5 font-normal text-slate-600">injected into the system prompt when active</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="You are an expert code reviewer. Always check for security vulnerabilities, suggest improvements, and explain your reasoning clearly."
                className="bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 resize-y leading-relaxed transition-colors"
              />
            </div>

            {/* Allowed tools */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">
                Allowed tools
                <span className="ml-1.5 font-normal text-slate-600">comma-separated — leave blank for all</span>
              </label>
              <input
                value={allowedTools}
                onChange={(e) => setAllowedTools(e.target.value)}
                placeholder="web_search, code_execution"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </div>

            {/* Version history */}
            {initial && (initial.version_history as object[]).length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Version history</label>
                <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700/50 overflow-hidden">
                  {(initial.version_history as { version: string; saved_at: string }[])
                    .slice()
                    .reverse()
                    .map((h, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400">v{h.version}</span>
                        <span className="text-[10px] text-slate-600">
                          {new Date(h.saved_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700 shrink-0">
          <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Create skill"}
          </button>
        </div>
      </div>
    </div>
  );
}
