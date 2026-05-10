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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AVATAR_COLORS = [
  "bg-indigo-600",
  "bg-violet-600",
  "bg-teal-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-pink-600",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ConversationItemProps {
  conversation: Conversation;
  previewText: string;
  previewRole: "user" | "assistant" | null;
  allTags: Tag[];
  allProjects: Project[];
  userId: string;
  isActive: boolean;
  isSelected: boolean;
  bulkMode: boolean;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
}

export function ConversationItem({
  conversation: conv,
  previewText,
  previewRole,
  allTags,
  allProjects,
  userId,
  isActive,
  isSelected,
  bulkMode,
  onSelect,
  onCheck,
}: ConversationItemProps) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const convProject = allProjects.find((p) => p.id === conv.project_id);

  const title = conv.title ?? "New conversation";
  const initial = title.charAt(0).toUpperCase();
  const isArchived = conv.status === "archived";
  const isSnoozed = conv.status === "snoozed";

  const handleArchive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      isArchived || isSnoozed
        ? restoreConversation(conv.id)
        : archiveConversation(conv.id);
    },
    [conv.id, isArchived, isSnoozed]
  );

  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      pinConversation(conv.id, !conv.pinned);
    },
    [conv.id, conv.pinned]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    },
    [conv.id]
  );

  const handleTagToggle = useCallback(
    (tagId: string, checked: boolean) => {
      const next = checked
        ? [...conv.tags, tagId]
        : conv.tags.filter((t) => t !== tagId);
      setConversationTags(conv.id, next);
    },
    [conv.id, conv.tags]
  );

  const convTagObjects = allTags.filter((t) => conv.tags.includes(t.id));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "group/item relative flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors select-none",
        isActive ? "bg-slate-700" : "hover:bg-slate-800/70"
      )}
    >
      {/* Checkbox (bulk mode) */}
      {bulkMode && (
        <div
          className="mt-0.5 shrink-0"
          onClick={(e) => { e.stopPropagation(); onCheck(!isSelected); }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onCheck(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
          />
        </div>
      )}

      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-white",
          avatarColor(conv.id)
        )}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-medium text-slate-200 truncate leading-tight">
            {title}
          </span>
          {/* Timestamp / hover actions */}
          <div className="shrink-0 flex items-center gap-0.5">
            <span className="text-[10px] text-slate-500 group-hover/item:hidden">
              {relativeTime(conv.updated_at)}
            </span>
            {/* Hover action buttons */}
            <div className="hidden group-hover/item:flex items-center gap-0.5">
              <HoverBtn
                label={conv.pinned ? "Unpin" : "Pin"}
                onClick={handlePin}
                active={conv.pinned}
              >
                <Pin size={11} />
              </HoverBtn>
              <div className="relative">
                <HoverBtn
                  label="Snooze"
                  onClick={(e) => { e.stopPropagation(); setShowSnooze((v) => !v); setShowTags(false); }}
                >
                  <Clock size={11} />
                </HoverBtn>
                {showSnooze && (
                  <SnoozePicker
                    onSnooze={(until) => snoozeConversation(conv.id, until)}
                    onClose={() => setShowSnooze(false)}
                  />
                )}
              </div>
              <div className="relative">
                <HoverBtn
                  label="Tags"
                  onClick={(e) => { e.stopPropagation(); setShowTags((v) => !v); setShowSnooze(false); setShowProjectPicker(false); }}
                >
                  <TagIcon size={11} />
                </HoverBtn>
                {showTags && (
                  <TagPicker
                    userId={userId}
                    allTags={allTags}
                    selectedTagIds={conv.tags}
                    onToggle={handleTagToggle}
                    onClose={() => setShowTags(false)}
                  />
                )}
              </div>
              <div className="relative">
                <HoverBtn
                  label="Assign project"
                  onClick={(e) => { e.stopPropagation(); setShowProjectPicker((v) => !v); setShowTags(false); setShowSnooze(false); }}
                  active={!!conv.project_id}
                >
                  <FolderOpen size={11} />
                </HoverBtn>
                {showProjectPicker && (
                  <ProjectPicker
                    projects={allProjects}
                    selectedProjectId={conv.project_id}
                    onSelect={(pid) => updateConversation(conv.id, { project_id: pid })}
                    onClose={() => setShowProjectPicker(false)}
                  />
                )}
              </div>
              <HoverBtn
                label={isArchived || isSnoozed ? "Move to inbox" : "Archive"}
                onClick={handleArchive}
              >
                {isArchived || isSnoozed ? <RotateCcw size={11} /> : <Archive size={11} />}
              </HoverBtn>
              <HoverBtn label="Delete" onClick={handleDelete} danger>
                <Trash2 size={11} />
              </HoverBtn>
            </div>
          </div>
        </div>

        {/* Preview */}
        <p className="text-[11px] text-slate-500 truncate mt-0.5 leading-tight">
          {previewRole === "user" ? "You: " : ""}
          {previewText || <span className="italic">No messages yet</span>}
        </p>
        {isSnoozed && conv.snoozed_until && (
          <p className="text-[10px] text-amber-500/70 mt-0.5 flex items-center gap-1">
            <Clock size={9} className="shrink-0" />
            Until {new Date(conv.snoozed_until).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}

        {/* Project + tags + pin indicator */}
        {(convTagObjects.length > 0 || conv.pinned || convProject) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {conv.pinned && <Pin size={9} className="text-slate-500" />}
            {convProject && (
              <span
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: `${convProject.color ?? "#64748b"}22`, color: convProject.color ?? "#94a3b8" }}
              >
                <FolderOpen size={8} />
                {convProject.name}
              </span>
            )}
            {convTagObjects.map((tag) => (
              <span
                key={tag.id}
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: tag.color }}
                title={tag.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HoverBtn({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
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
        "p-1 rounded transition-colors",
        danger
          ? "text-slate-500 hover:text-red-400 hover:bg-slate-700"
          : active
          ? "text-indigo-400 hover:bg-slate-700"
          : "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
      )}
    >
      {children}
    </button>
  );
}
