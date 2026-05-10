"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Zap, GitBranch, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import {
  useSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkill,
} from "@/lib/claude-inbox/data/skills";
import { SkillForm } from "@/components/claude-inbox/skill-form";
import type { Skill } from "@/lib/claude-inbox/sync/types";

function SkillCard({
  skill,
  onEdit,
  onDelete,
  onToggle,
}: {
  skill: Skill;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const preview = skill.body.slice(0, 100) + (skill.body.length > 100 ? "…" : "");

  return (
    <div className={cn(
      "group/card bg-slate-800 border rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors",
      skill.enabled ? "border-slate-700" : "border-slate-700/50 opacity-60"
    )}>
      <div className={cn("h-1 shrink-0", skill.enabled ? "bg-indigo-500" : "bg-slate-600")} />

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", skill.enabled ? "bg-indigo-500/20" : "bg-slate-700")}>
              <Zap size={14} className={skill.enabled ? "text-indigo-400" : "text-slate-500"} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{skill.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-600 font-mono">v{skill.version}</span>
                {skill.source === "github" && <GitBranch size={9} className="text-slate-600" />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
            <button onClick={onToggle} title={skill.enabled ? "Disable" : "Enable"} className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
              {skill.enabled ? <ToggleRight size={14} className="text-indigo-400" /> : <ToggleLeft size={14} />}
            </button>
            <button onClick={onEdit} title="Edit" className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} title="Delete" className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {skill.description && (
          <p className="text-xs text-slate-500 leading-relaxed">{skill.description}</p>
        )}

        <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
          {preview}
        </p>

        {skill.allowed_tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            {skill.allowed_tools.map((t) => (
              <span key={t} className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SkillsPage() {
  const { userId } = useSyncContext();
  const skills = useSkills(userId);
  const [editing, setEditing] = useState<Skill | null | "new">(null);

  async function handleSave(data: {
    name: string;
    description: string;
    body: string;
    version: string;
    allowed_tools: string[];
  }) {
    if (editing === "new") {
      await createSkill(userId, { ...data, source: "paste" });
    } else if (editing) {
      await updateSkill(editing.id, data);
    }
    setEditing(null);
  }

  const isLoading = skills === undefined;
  const enabledCount = skills?.filter((s) => s.enabled).length ?? 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Skills</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Reusable instructions injected into the system prompt.
            {!isLoading && skills!.length > 0 && (
              <span className="ml-1 text-indigo-400">{enabledCount} active</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          New skill
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl h-36 animate-pulse" />
            ))}
          </div>
        ) : skills!.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
              <Zap size={24} className="text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-300">No skills yet</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Skills are reusable instruction sets injected into Claude&apos;s system prompt. Import from GitHub or write your own.
              </p>
            </div>
            <button onClick={() => setEditing("new")} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              Create your first skill
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills!.map((s) => (
              <SkillCard
                key={s.id}
                skill={s}
                onEdit={() => setEditing(s)}
                onDelete={() => deleteSkill(s.id)}
                onToggle={() => toggleSkill(s.id, !s.enabled)}
              />
            ))}
          </div>
        )}
      </div>

      {editing !== null && (
        <SkillForm
          initial={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
