"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, MessageSquare, ArrowRight, FolderOpen, FileText } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import {
  useProjects,
  useProjectConversationCount,
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/claude-inbox/data/projects";
import { ProjectForm } from "@/components/claude-inbox/project-form";
import { ProjectContextModal } from "@/components/claude-inbox/project-context-modal";
import type { Project } from "@/lib/claude-inbox/sync/types";

function ProjectCard({
  project,
  onEdit,
  onDelete,
  onContext,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onContext: () => void;
}) {
  const count = useProjectConversationCount(project.id);
  const color = project.color ?? "#64748b";

  return (
    <div className="group/card bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors">
      {/* Color bar */}
      <div className="h-1.5 shrink-0" style={{ background: color }} />

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
              <FolderOpen size={15} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">{project.name}</p>
              {project.description && (
                <p className="text-xs text-slate-500 mt-0.5 leading-tight line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
            <button
              onClick={onContext}
              title="Manage project context"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <FileText size={13} />
            </button>
            <button
              onClick={onEdit}
              title="Edit project"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              title="Delete project"
              className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Advanced indicator */}
        {(project.system_prompt || project.default_model || project.project_context) && (
          <div className="flex gap-2 mb-3">
            {project.default_model && (
              <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                {project.default_model.split("-").slice(1, 3).join(" ")}
              </span>
            )}
            {project.system_prompt && (
              <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                Custom prompt
              </span>
            )}
            {project.project_context && (
              <span className="text-[10px] bg-slate-700 text-indigo-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <FileText size={9} />
                Context
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MessageSquare size={12} />
            <span>{count ?? 0} conversation{count !== 1 ? "s" : ""}</span>
          </div>
          <Link
            href={`/claude-inbox/inbox?project=${project.id}`}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { userId } = useSyncContext();
  const projects = useProjects(userId);
  const [editingProject, setEditingProject] = useState<Project | null | "new">(null);
  const [contextProject, setContextProject] = useState<Project | null>(null);

  async function handleSave(data: {
    name: string;
    description: string;
    color: string;
    system_prompt: string;
    default_model: string;
  }) {
    if (editingProject === "new") {
      await createProject(userId, data);
    } else if (editingProject) {
      await updateProject(editingProject.id, data);
    }
    setEditingProject(null);
  }

  const isLoading = projects === undefined;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Projects</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Group conversations with shared instructions and settings.
          </p>
        </div>
        <button
          onClick={() => setEditingProject("new")}
          className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          New project
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl h-32 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
              <FolderOpen size={24} className="text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-300">No projects yet</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Create a project to group related conversations with shared system prompts and model settings.
              </p>
            </div>
            <button
              onClick={() => setEditingProject("new")}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setEditingProject(project)}
                onDelete={() => deleteProject(project.id)}
                onContext={() => setContextProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {editingProject !== null && (
        <ProjectForm
          initial={editingProject === "new" ? undefined : editingProject}
          onSave={handleSave}
          onCancel={() => setEditingProject(null)}
        />
      )}

      {/* Context modal */}
      {contextProject !== null && (
        <ProjectContextModal
          project={contextProject}
          onClose={() => setContextProject(null)}
        />
      )}
    </div>
  );
}
