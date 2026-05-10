"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Hash, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import {
  useTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/claude-inbox/data/templates";
import { TemplateForm } from "@/components/claude-inbox/template-form";
import type { Template } from "@/lib/claude-inbox/sync/types";

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const preview = template.body.slice(0, 120) + (template.body.length > 120 ? "…" : "");

  return (
    <div className="group/card bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-2 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-indigo-400 font-mono text-sm shrink-0">/</span>
          <span className="text-sm font-medium text-slate-100 truncate">{template.name}</span>
          {template.usage_count > 0 && (
            <span className="text-[10px] text-slate-600 shrink-0">×{template.usage_count}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            title="Edit"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap break-words">{preview}</p>

      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {template.variables.map((v) => (
            <span
              key={v}
              className="text-[10px] bg-slate-700 text-indigo-300 px-1.5 py-0.5 rounded font-mono"
            >
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const { userId } = useSyncContext();
  const templates = useTemplates(userId);
  const [editing, setEditing] = useState<Template | null | "new">(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && editing === null) router.push("/claude-inbox/inbox");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, editing]);

  async function handleSave(data: { name: string; body: string }) {
    if (editing === "new") {
      await createTemplate(userId, data);
    } else if (editing) {
      await updateTemplate(editing.id, data);
    }
    setEditing(null);
  }

  const isLoading = templates === undefined;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Templates</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Type <span className="font-mono text-indigo-400">/name</span> in any message to insert a template.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            New template
          </button>
          <button
            onClick={() => router.push("/claude-inbox/inbox")}
            aria-label="Back to inbox"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
              <Hash size={24} className="text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-300">No templates yet</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Create reusable message templates with{" "}
                <span className="font-mono text-indigo-400">{"{{variable}}"}</span> placeholders.
                Trigger them by typing <span className="font-mono text-indigo-400">/</span> in the compose bar.
              </p>
            </div>
            <button
              onClick={() => setEditing("new")}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Create your first template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => setEditing(t)}
                onDelete={() => deleteTemplate(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {editing !== null && (
        <TemplateForm
          initial={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
