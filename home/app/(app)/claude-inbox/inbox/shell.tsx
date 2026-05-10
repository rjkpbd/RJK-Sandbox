"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationListPane } from "@/components/claude-inbox/conversation-list-pane";
import { ThreadPane } from "@/components/claude-inbox/thread-pane";
import { CommandPalette } from "@/components/claude-inbox/command-palette";
import { KeyboardShortcutsModal } from "@/components/claude-inbox/keyboard-shortcuts-modal";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import { createConversation, getNextInboxConversation } from "@/lib/claude-inbox/data/conversations";
import { DEFAULT_MODEL_ID } from "@/lib/claude-inbox/config/models";
import { useUserSettings } from "@/lib/claude-inbox/data/user-settings";
import { runAutoArchive } from "@/lib/claude-inbox/data/auto-archive";
import { StorageQuotaBanner } from "@/components/claude-inbox/storage-quota-banner";

export function InboxShell() {
  const { userId } = useSyncContext();
  const settings = useUserSettings(userId);
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project") ?? null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const autoArchiveRan = useRef(false);

  // Run auto-archive once when settings load with auto_archive_days configured
  useEffect(() => {
    if (!settings?.auto_archive_days || autoArchiveRan.current) return;
    autoArchiveRan.current = true;
    runAutoArchive(userId, settings.auto_archive_days).catch(() => {});
  }, [settings, userId]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setMobileView("thread");
  }, []);

  const handleBack = useCallback(() => {
    setMobileView("list");
  }, []);

  const handleNewConversation = useCallback(async () => {
    const id = await createConversation(userId, settings?.default_model ?? DEFAULT_MODEL_ID);
    setActiveId(id);
    setMobileView("thread");
  }, [userId, settings?.default_model]);

  const handleArchived = useCallback(async () => {
    if (!activeId) return;
    const nextId = await getNextInboxConversation(userId, activeId, projectFilter);
    setActiveId(nextId);
    if (!nextId) setMobileView("list");
  }, [userId, activeId, projectFilter]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // ⌘K — command palette
      if (meta && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      // ⌘N — new conversation (not in text fields)
      if (meta && e.key === "n" && !inInput) {
        e.preventDefault();
        handleNewConversation();
        return;
      }

      // ⌘/ — keyboard shortcuts popup
      if (meta && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      // ? — keyboard shortcuts (not in inputs, no modifier)
      if (e.key === "?" && !inInput && !meta) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      // Escape — close modals or clear active conversation
      if (e.key === "Escape" && !inInput) {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (!paletteOpen) { setActiveId(null); setMobileView("list"); }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewConversation, paletteOpen, shortcutsOpen]);

  return (
    <>
      <ConversationListPane
        activeId={activeId}
        projectFilter={projectFilter}
        searchRef={searchRef}
        onSelect={handleSelect}
        mobileHidden={mobileView === "thread"}
      />
      <ThreadPane
        conversationId={activeId}
        userId={userId}
        onFork={setActiveId}
        onArchived={handleArchived}
        mobileHidden={mobileView === "list"}
        onBack={handleBack}
      />
      <CommandPalette
        userId={userId}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectConversation={(id) => { setActiveId(id); setMobileView("thread"); setPaletteOpen(false); }}
        onNewConversation={handleNewConversation}
      />
      <StorageQuotaBanner />
      {shortcutsOpen && <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}
