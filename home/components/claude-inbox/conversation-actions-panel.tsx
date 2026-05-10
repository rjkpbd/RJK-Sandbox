"use client";

import { useState, useCallback } from "react";
import { Pin, Archive, Clock, Tag as TagIcon, Trash2, RotateCcw, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation, Tag } from "@/lib/claude-inbox/sync/types";
import type { Project } from "@/lib/claude-inbox/sync/types";
import {
  archiveConversation,
  restoreConversation,
  pinConversation,
  snoozeConversation,
  deleteConversation,
  setConversationTags,
  updateConversation,
} from "@/lib/claude-inbox/data/conversations";
import { SnoozePicker } from "./snooze-picker";
import { TagPicker } from "./tag-picker";
import { ProjectPicker } from "./project-picker";

interface ConversationActionsPanelProps {
  conversation: Conversation;
  userId: string;
  allTags: Tag[];
  allProjects: Project[];
  onDeleted: () => void;
  onArchived?: () => void;
}

export function ConversationActionsPanel({
  conversation,
  userId,
  allTags,
  allProjects,
  onDeleted,
  onArchived,
}: ConversationActionsPanelProps) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showProject, setShowProject] = useState(false);

  const conv = conversation;
  const isArchived = conv.status === "archived";
  const isSnoozed = conv.status === "snoozed";

  const closeAll = useCallback(() => {
    setShowSnooze(false);
    setShowTags(false);
    setShowProject(false);
  }, []);

  const handleTagToggle = useCallback(
    (tagId: string, checked: boolean) => {
      const next = checked ? [...conv.tags, tagId] : conv.tags.filter((t) => t !== tagId);
      setConversationTags(conv.id, next);
    },
    [conv.id, conv.tags]
  );

  return (
    <div className="flex flex-col items-center gap-1 w-10 shrink-0 border-l border-slate-700 py-3 bg-slate-900/50">
      {/* Pin */}
      <PanelBtn
        label={conv.pinned ? "Unpin" : "Pin"}
        active={conv.pinned}
        onClick={() => pinConversation(conv.id, !conv.pinned)}
      >
        <Pin size={14} />
      </PanelBtn>

      {/* Tags */}
      <div className="relative">
        <PanelBtn
          label="Tags"
          active={conv.tags.length > 0}
          onClick={() => { const v = !showTags; closeAll(); setShowTags(v); }}
        >
          <TagIcon size={14} />
        </PanelBtn>
        {showTags && (
          <TagPicker
            userId={userId}
            allTags={allTags}
            selectedTagIds={conv.tags}
            onToggle={handleTagToggle}
            onClose={() => setShowTags(false)}
            align="right"
          />
        )}
      </div>

      {/* Snooze */}
      <div className="relative">
        <PanelBtn
          label="Snooze"
          active={isSnoozed}
          onClick={() => { const v = !showSnooze; closeAll(); setShowSnooze(v); }}
        >
          <Clock size={14} />
        </PanelBtn>
        {showSnooze && (
          <SnoozePicker
            onSnooze={(until) => snoozeConversation(conv.id, until)}
            onClose={() => setShowSnooze(false)}
            align="right"
          />
        )}
      </div>

      {/* Archive / restore */}
      <PanelBtn
        label={isArchived || isSnoozed ? "Move to inbox" : "Archive"}
        onClick={() => {
          if (isArchived || isSnoozed) {
            restoreConversation(conv.id);
          } else {
            archiveConversation(conv.id);
            onArchived?.();
          }
        }}
      >
        {isArchived || isSnoozed ? <RotateCcw size={14} /> : <Archive size={14} />}
      </PanelBtn>

      {/* Assign project */}
      <div className="relative">
        <PanelBtn
          label="Assign project"
          active={!!conv.project_id}
          onClick={() => { const v = !showProject; closeAll(); setShowProject(v); }}
        >
          <FolderOpen size={14} />
        </PanelBtn>
        {showProject && (
          <ProjectPicker
            projects={allProjects}
            selectedProjectId={conv.project_id}
            onSelect={(pid) => { updateConversation(conv.id, { project_id: pid }); setShowProject(false); }}
            onClose={() => setShowProject(false)}
            align="right"
          />
        )}
      </div>

      <div className="flex-1" />

      {/* Delete */}
      <PanelBtn
        label="Delete conversation"
        danger
        onClick={() => { deleteConversation(conv.id); onDeleted(); }}
      >
        <Trash2 size={14} />
      </PanelBtn>
    </div>
  );
}

function PanelBtn({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "p-2 rounded-md transition-colors w-8 h-8 flex items-center justify-center",
        danger
          ? "text-slate-600 hover:text-red-400 hover:bg-slate-800"
          : active
          ? "text-indigo-400 hover:bg-slate-800"
          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}
