"use client";

import { useState, useMemo, useCallback } from "react";
import { PenSquare, Search, Inbox, Archive, Clock, CheckSquare, X, FolderOpen, FileText, Sparkles, Server, Download, Settings, Tag as TagIcon, Pin as PinIcon, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SyncStatusIndicator } from "./sync-status-indicator";
import { ConversationItem } from "./conversation-item";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import {
  useConversationList,
  useTagList,
  useConversationsByTag,
  createConversation,
  setConversationTags,
  bulkArchive,
  bulkDelete,
} from "@/lib/claude-inbox/data/conversations";
import { useProjects } from "@/lib/claude-inbox/data/projects";
import { useUserSettings } from "@/lib/claude-inbox/data/user-settings";
import { DEFAULT_MODEL_ID } from "@/lib/claude-inbox/config/models";
import type { ConversationStatus } from "@/lib/claude-inbox/sync/types";

const NAV_LINKS = [
  { href: "/claude-inbox/projects", label: "Projects", Icon: FolderOpen },
  { href: "/claude-inbox/templates", label: "Templates", Icon: FileText },
  { href: "/claude-inbox/skills", label: "Skills", Icon: Sparkles },
  { href: "/claude-inbox/mcp", label: "MCP servers", Icon: Server },
  { href: "/claude-inbox/export", label: "Export", Icon: Download },
  { href: "/claude-inbox/settings", label: "Settings", Icon: Settings },
] as const;

type Tab = "inbox" | "archived" | "snoozed";
type ViewMode = "list" | "tags";

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }[] = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "archived", label: "Archived", Icon: Archive },
  { id: "snoozed", label: "Snoozed", Icon: Clock },
];

const TAB_STATUS: Record<Tab, ConversationStatus> = {
  inbox: "inbox",
  archived: "archived",
  snoozed: "snoozed",
};

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { title: string; body: string }> = {
    inbox: { title: "Your inbox is empty", body: "Start a new conversation using the button above." },
    archived: { title: "Nothing archived", body: "Conversations you archive will appear here." },
    snoozed: { title: "Nothing snoozed", body: "Snoozed conversations will reappear here when they're due." },
  };
  const { title, body } = messages[tab];
  return (
    <div className="flex flex-col items-center justify-center gap-2 flex-1 px-6 text-center py-12">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

interface ConversationListPaneProps {
  activeId: string | null;
  projectFilter?: string | null;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  mobileHidden?: boolean;
}

function loadPinnedTags(): string[] {
  try { return JSON.parse(localStorage.getItem("claude-inbox-pinned-tags") ?? "[]"); }
  catch { return []; }
}

export function ConversationListPane({ activeId, projectFilter, searchRef, onSelect, mobileHidden }: ConversationListPaneProps) {
  const { userId } = useSyncContext();
  const settings = useUserSettings(userId);
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pinnedTagIds, setPinnedTagIds] = useState<string[]>(loadPinnedTags);
  const [expandedPinnedTags, setExpandedPinnedTags] = useState<Set<string>>(new Set());
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const conversations = useConversationList(userId, TAB_STATUS[activeTab], projectFilter);
  const allTags = useTagList(userId) ?? [];
  const allProjects = useProjects(userId) ?? [];
  const tagConversations = useConversationsByTag(userId, selectedTagId);

  const filtered = useMemo(() => {
    if (!conversations) return undefined;
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      ({ conversation: c, previewText }) =>
        (c.title ?? "").toLowerCase().includes(q) ||
        previewText.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const pinnedTagConversations = useMemo(() => {
    if (!filtered || pinnedTagIds.length === 0) return {} as Record<string, typeof filtered>;
    const map: Record<string, typeof filtered> = {};
    for (const tagId of pinnedTagIds) {
      map[tagId] = filtered.filter(({ conversation: c }) => c.tags.includes(tagId));
    }
    return map;
  }, [filtered, pinnedTagIds]);

  const togglePinnedTag = useCallback((tagId: string) => {
    setPinnedTagIds((prev) => {
      const next = prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId];
      localStorage.setItem("claude-inbox-pinned-tags", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleExpandedTag = useCallback((tagId: string) => {
    setExpandedPinnedTags((prev) => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });
  }, []);

  const handleNewConversation = useCallback(async () => {
    const id = await createConversation(
      userId,
      settings?.default_model ?? DEFAULT_MODEL_ID,
      projectFilter ? { project_id: projectFilter } : undefined
    );
    if (selectedTagId) {
      await setConversationTags(id, [selectedTagId]);
    }
    onSelect(id);
  }, [userId, onSelect, projectFilter, selectedTagId, settings?.default_model]);

  const handleCheck = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const handleBulkArchive = useCallback(async () => {
    await bulkArchive(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    await bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds]);

  const handleCancelBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  const isLoading = conversations === undefined;

  return (
    <aside className={cn("flex flex-col w-full md:w-72 md:shrink-0 border-r border-slate-700 bg-slate-900", mobileHidden && "hidden md:flex")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
        <h2 className="text-sm font-semibold text-white">Claude Inbox</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setViewMode((v) => { if (v === "tags") { setSelectedTagId(null); return "list"; } return "tags"; }); }}
            title="Browse tags"
            aria-label="Browse tags"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "tags"
                ? "text-indigo-400 bg-slate-700"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            )}
          >
            <TagIcon size={14} />
          </button>
          <button
            onClick={() => { setBulkMode((v) => !v); setSelectedIds(new Set()); }}
            title="Select conversations"
            aria-label="Select conversations"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              bulkMode
                ? "text-indigo-400 bg-slate-700"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            )}
          >
            <CheckSquare size={14} />
          </button>
          <button
            onClick={handleNewConversation}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="New conversation"
            aria-label="New conversation"
          >
            <PenSquare size={15} />
          </button>
        </div>
      </div>

      {/* Project filter indicator */}
      {projectFilter && (() => {
        const proj = allProjects.find((p) => p.id === projectFilter);
        if (!proj) return null;
        const color = proj.color ?? "#64748b";
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700 shrink-0" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-xs font-medium text-slate-200 flex-1 truncate">{proj.name}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">project</span>
          </div>
        );
      })()}

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-700 shrink-0">
        <label className="flex items-center gap-2 bg-slate-800 rounded-md px-2.5 py-1.5">
          <Search size={13} className="text-slate-500 shrink-0" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search… (⌘/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 outline-none"
          />
        </label>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 shrink-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
              activeTab === id
                ? "text-indigo-400 border-b-2 border-indigo-400 -mb-px"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Icon size={12} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* List body */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {viewMode === "tags" ? (
          /* ── Tags browser ─────────────────────────────────────── */
          selectedTagId ? (
            /* ── Tag detail: conversations with this tag ─────────── */
            <div className="flex flex-col flex-1">
              {/* Back header */}
              {(() => {
                const tag = allTags.find((t) => t.id === selectedTagId);
                return (
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50 shrink-0">
                    <button
                      onClick={() => setSelectedTagId(null)}
                      className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-700"
                      aria-label="Back to tags"
                    >
                      <ChevronRight size={13} className="rotate-180" />
                    </button>
                    {tag && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />}
                    <span className="text-xs font-medium text-slate-300 flex-1 truncate">{tag?.name ?? "Tag"}</span>
                    <span className="text-[10px] text-slate-500">{tagConversations?.length ?? 0}</span>
                  </div>
                );
              })()}
              {/* Conversations split by status */}
              {tagConversations === undefined ? (
                <div className="px-4 py-3 text-xs text-slate-500 animate-pulse">Loading…</div>
              ) : tagConversations.length === 0 ? (
                <p className="px-4 py-6 text-xs text-slate-500 text-center">No conversations with this tag.</p>
              ) : (() => {
                const inboxConvs = tagConversations.filter(({ conversation: c }) => c.status === "inbox" || c.status === "snoozed");
                const archivedConvs = tagConversations.filter(({ conversation: c }) => c.status === "archived");
                const renderList = (items: typeof tagConversations) => items.map(({ conversation, previewText, previewRole }) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    previewText={previewText}
                    previewRole={previewRole}
                    allTags={allTags}
                    allProjects={allProjects}
                    userId={userId}
                    isActive={conversation.id === activeId}
                    isSelected={selectedIds.has(conversation.id)}
                    bulkMode={bulkMode}
                    onSelect={() => onSelect(conversation.id)}
                    onCheck={(checked) => handleCheck(conversation.id, checked)}
                  />
                ));
                return (
                  <>
                    {inboxConvs.length > 0 && (
                      <>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide px-4 pt-3 pb-1">Inbox</p>
                        {renderList(inboxConvs)}
                      </>
                    )}
                    {archivedConvs.length > 0 && (
                      <>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide px-4 pt-3 pb-1">Archived</p>
                        {renderList(archivedConvs)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            /* ── Tag list ─────────────────────────────────────────── */
            <div className="flex flex-col">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide px-4 py-2">All tags</p>
              {allTags.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500">No tags yet. Tag a conversation to create one.</p>
              ) : allTags.map((tag) => {
                const isPinned = pinnedTagIds.includes(tag.id);
                const count = (conversations ?? []).filter(({ conversation: c }) => c.tags.includes(tag.id)).length;
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTagId(tag.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedTagId(tag.id)}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tag.color }} />
                    <span className="flex-1 text-xs text-slate-200 truncate">{tag.name}</span>
                    {count > 0 && <span className="text-[10px] text-slate-500 shrink-0">{count}</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePinnedTag(tag.id); }}
                      title={isPinned ? "Unpin from inbox" : "Pin to inbox"}
                      aria-label={isPinned ? "Unpin from inbox" : "Pin to inbox"}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isPinned ? "text-indigo-400" : "text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <PinIcon size={11} />
                    </button>
                    <ChevronRight size={11} className="text-slate-600 opacity-0 group-hover:opacity-100 shrink-0" />
                  </div>
                );
              })}
            </div>
          )
        ) : isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-3 bg-slate-700 rounded w-28" />
                  <div className="h-2.5 bg-slate-700 rounded w-10 shrink-0" />
                </div>
                <div className="h-2.5 bg-slate-700 rounded w-full" />
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Pinned tag sections */}
            {pinnedTagIds.map((tagId) => {
              const tag = allTags.find((t) => t.id === tagId);
              if (!tag) return null;
              const tagConvs = pinnedTagConversations[tagId] ?? [];
              const expanded = expandedPinnedTags.has(tagId);
              return (
                <div key={tagId} className="border-b border-slate-700/50">
                  <button
                    onClick={() => toggleExpandedTag(tagId)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/60 transition-colors"
                  >
                    {expanded ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                    <span className="flex-1 text-left text-xs text-slate-300 truncate">{tag.name}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{tagConvs.length}</span>
                  </button>
                  {expanded && tagConvs.length > 0 && tagConvs.map(({ conversation, previewText, previewRole }) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      previewText={previewText}
                      previewRole={previewRole}
                      allTags={allTags}
                      allProjects={allProjects}
                      userId={userId}
                      isActive={conversation.id === activeId}
                      isSelected={selectedIds.has(conversation.id)}
                      bulkMode={bulkMode}
                      onSelect={() => onSelect(conversation.id)}
                      onCheck={(checked) => handleCheck(conversation.id, checked)}
                    />
                  ))}
                  {expanded && tagConvs.length === 0 && (
                    <p className="px-8 py-2 text-[11px] text-slate-600 italic">No conversations with this tag in current view.</p>
                  )}
                </div>
              );
            })}
            {/* Normal conversation list */}
            {filtered && filtered.length > 0 ? (
              filtered.map(({ conversation, previewText, previewRole }) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  previewText={previewText}
                  previewRole={previewRole}
                  allTags={allTags}
                  allProjects={allProjects}
                  userId={userId}
                  isActive={conversation.id === activeId}
                  isSelected={selectedIds.has(conversation.id)}
                  bulkMode={bulkMode}
                  onSelect={() => onSelect(conversation.id)}
                  onCheck={(checked) => handleCheck(conversation.id, checked)}
                />
              ))
            ) : (
              <EmptyState tab={activeTab} />
            )}
          </>
        )}
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="px-3 py-2.5 border-t border-slate-700 shrink-0 flex items-center gap-2">
          <span className="text-xs text-slate-400 flex-1">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkArchive}
            className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Archive
          </button>
          <button
            onClick={handleBulkDelete}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Delete
          </button>
          <button onClick={handleCancelBulk} className="text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Section nav */}
      <div className="flex items-center justify-around px-3 py-2 border-t border-slate-700 shrink-0">
        {NAV_LINKS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              pathname === href
                ? "text-indigo-400 bg-slate-700"
                : "text-slate-500 hover:text-slate-200 hover:bg-slate-700"
            )}
          >
            <Icon size={14} />
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 shrink-0">
        <SyncStatusIndicator />
      </div>
    </aside>
  );
}
