"use client";

import { useEffect, useRef } from "react";
import { FolderOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/claude-inbox/sync/types";

interface ProjectPickerProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (projectId: string | null) => void;
  onClose: () => void;
  align?: "left" | "right";
}

export function ProjectPicker({
  projects,
  selectedProjectId,
  onSelect,
  onClose,
  align = "left",
}: ProjectPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn("absolute z-50 mt-1 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 text-sm", align === "right" ? "right-0" : "left-0")}
    >
      <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 py-1.5">
        Assign project
      </p>

      {/* No project option */}
      <button
        onClick={() => { onSelect(null); onClose(); }}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors",
          !selectedProjectId ? "text-indigo-400" : "text-slate-400"
        )}
      >
        <X size={12} className="shrink-0" />
        <span className="text-left text-slate-200 truncate">No project</span>
        {!selectedProjectId && <span className="text-indigo-400 text-xs ml-auto">✓</span>}
      </button>

      {projects.length === 0 && (
        <p className="px-3 py-2 text-xs text-slate-500">No projects yet.</p>
      )}

      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => { onSelect(project.id); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors"
        >
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: project.color ?? "#64748b" }}
          />
          <span className="flex-1 text-left text-slate-200 truncate">{project.name}</span>
          {selectedProjectId === project.id && (
            <span className="text-indigo-400 text-xs">✓</span>
          )}
        </button>
      ))}
    </div>
  );
}
