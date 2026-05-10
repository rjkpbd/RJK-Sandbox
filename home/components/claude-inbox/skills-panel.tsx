"use client";

import { useState } from "react";
import { Zap, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateConversation } from "@/lib/claude-inbox/data/conversations";
import type { Skill } from "@/lib/claude-inbox/sync/types";

interface SkillsPanelProps {
  conversationId: string;
  allSkills: Skill[];
  pinnedSkillIds: string[];
  excludedSkillIds: string[];
}

export function SkillsPanel({
  conversationId,
  allSkills,
  pinnedSkillIds,
  excludedSkillIds,
}: SkillsPanelProps) {
  const [open, setOpen] = useState(false);

  if (allSkills.length === 0) return null;

  const activeCount = allSkills.filter((s) => {
    if (excludedSkillIds.includes(s.id)) return false;
    if (s.enabled || pinnedSkillIds.includes(s.id)) return true;
    return false;
  }).length;

  function toggle(skillId: string) {
    const skill = allSkills.find((s) => s.id === skillId);
    if (!skill) return;

    if (excludedSkillIds.includes(skillId)) {
      // Un-exclude
      updateConversation(conversationId, {
        excluded_skills: excludedSkillIds.filter((id) => id !== skillId),
      });
    } else if (!skill.enabled && !pinnedSkillIds.includes(skillId)) {
      // Pin (add to pinned)
      updateConversation(conversationId, {
        pinned_skills: [...pinnedSkillIds, skillId],
      });
    } else if (skill.enabled && !excludedSkillIds.includes(skillId)) {
      // Exclude globally-enabled skill
      updateConversation(conversationId, {
        excluded_skills: [...excludedSkillIds, skillId],
      });
    } else if (pinnedSkillIds.includes(skillId)) {
      // Unpin
      updateConversation(conversationId, {
        pinned_skills: pinnedSkillIds.filter((id) => id !== skillId),
      });
    }
  }

  return (
    <div className="shrink-0 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Active skills"
        className={cn(
          "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
          activeCount > 0
            ? open ? "text-indigo-400 bg-slate-700" : "text-indigo-400 hover:bg-slate-700"
            : open ? "text-slate-400 bg-slate-700" : "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
        )}
      >
        <Zap size={13} />
        <span className="hidden sm:inline">Skills</span>
        {activeCount > 0 && (
          <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1 rounded-full">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Skills for this conversation
            </p>
          </div>
          <ul className="py-1 max-h-60 overflow-y-auto">
            {allSkills.map((skill) => {
              const isPinned = pinnedSkillIds.includes(skill.id);
              const isExcluded = excludedSkillIds.includes(skill.id);
              const isActive = !isExcluded && (skill.enabled || isPinned);

              return (
                <li key={skill.id}>
                  <button
                    onClick={() => toggle(skill.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/60 transition-colors text-left"
                  >
                    <div className={cn(
                      "w-5 h-5 rounded flex items-center justify-center shrink-0",
                      isActive ? "bg-indigo-500/20" : "bg-slate-700"
                    )}>
                      <Zap size={10} className={isActive ? "text-indigo-400" : "text-slate-600"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs truncate", isActive ? "text-slate-200" : "text-slate-500")}>
                        {skill.name}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {isExcluded ? "Excluded" : isPinned ? "Pinned to this chat" : skill.enabled ? "Global" : "Disabled"}
                      </p>
                    </div>
                    {isPinned && <Pin size={10} className="text-indigo-400 shrink-0" />}
                    {isExcluded && <PinOff size={10} className="text-slate-600 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
