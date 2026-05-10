"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, MessageSquare, FolderOpen, Hash, Plus, ArrowRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDB } from "@/lib/claude-inbox/sync/db";
import type { Conversation, Project, Template } from "@/lib/claude-inbox/sync/types";

// ── Result types ──────────────────────────────────────────────────────────────

type ResultKind = "conversation" | "project" | "template" | "action";

interface PaletteResult {
  id: string;
  kind: ResultKind;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  onExecute: () => void;
}

// ── Search helpers ────────────────────────────────────────────────────────────

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function searchDB(
  userId: string,
  query: string
): Promise<{ conversations: Conversation[]; projects: Project[]; templates: Template[] }> {
  const db = getDB();
  const [conversations, projects, templates] = await Promise.all([
    db.conversations
      .where("user_id")
      .equals(userId)
      .filter(
        (c) =>
          matches(c.title ?? "", query) ||
          matches(c.id, query)
      )
      .limit(7)
      .toArray(),
    db.projects
      .where("user_id")
      .equals(userId)
      .filter((p) => matches(p.name, query) || matches(p.description ?? "", query))
      .limit(5)
      .toArray(),
    db.templates
      .where("user_id")
      .equals(userId)
      .filter((t) => matches(t.name, query) || matches(t.body, query))
      .limit(5)
      .toArray(),
  ]);
  return { conversations, projects, templates };
}

async function getRecentConversations(userId: string): Promise<Conversation[]> {
  const db = getDB();
  const all = await db.conversations
    .where("user_id")
    .equals(userId)
    .filter((c) => c.status === "inbox")
    .toArray();
  return all
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);
}

// ── Command Palette ───────────────────────────────────────────────────────────

interface CommandPaletteProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function CommandPalette({
  userId,
  open,
  onClose,
  onSelectConversation,
  onNewConversation,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Build results
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const q = query.trim();

      if (!q) {
        const recents = await getRecentConversations(userId);
        if (cancelled) return;
        const items: PaletteResult[] = [
          {
            id: "__new__",
            kind: "action",
            label: "New conversation",
            icon: <Plus size={14} className="text-indigo-400" />,
            onExecute: () => { onNewConversation(); onClose(); },
          },
          {
            id: "__inbox__",
            kind: "action",
            label: "Go to inbox",
            icon: <Inbox size={14} className="text-slate-400" />,
            onExecute: onClose,
          },
          ...recents.map((c): PaletteResult => ({
            id: c.id,
            kind: "conversation",
            label: c.title ?? "Untitled conversation",
            icon: <MessageSquare size={14} className="text-slate-400" />,
            onExecute: () => { onSelectConversation(c.id); onClose(); },
          })),
        ];
        setResults(items);
        setActiveIdx(0);
        return;
      }

      const { conversations, projects, templates } = await searchDB(userId, q);
      if (cancelled) return;

      const items: PaletteResult[] = [
        ...conversations.map((c): PaletteResult => ({
          id: c.id,
          kind: "conversation",
          label: c.title ?? "Untitled conversation",
          sublabel: "Conversation",
          icon: <MessageSquare size={14} className="text-slate-400" />,
          onExecute: () => { onSelectConversation(c.id); onClose(); },
        })),
        ...projects.map((p): PaletteResult => ({
          id: p.id,
          kind: "project",
          label: p.name,
          sublabel: "Project",
          icon: <FolderOpen size={14} style={{ color: p.color ?? "#64748b" }} />,
          onExecute: onClose,
        })),
        ...templates.map((t): PaletteResult => ({
          id: t.id,
          kind: "template",
          label: `/${t.name}`,
          sublabel: t.body.slice(0, 60),
          icon: <Hash size={14} className="text-indigo-400" />,
          onExecute: onClose,
        })),
      ];

      if (items.length === 0) {
        items.push({
          id: "__new__",
          kind: "action",
          label: `New conversation: "${q}"`,
          icon: <Plus size={14} className="text-indigo-400" />,
          onExecute: () => { onNewConversation(); onClose(); },
        });
      }

      setResults(items);
      setActiveIdx(0);
    })();

    return () => { cancelled = true; };
  }, [query, open, userId, onClose, onSelectConversation, onNewConversation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % Math.max(results.length, 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      results[activeIdx]?.onExecute();
    }
  }, [results, activeIdx, onClose]);

  if (!open) return null;

  const sectionLabel = (kind: ResultKind) => {
    if (kind === "conversation") return "Conversations";
    if (kind === "project") return "Projects";
    if (kind === "template") return "Templates";
    return query ? "Actions" : "Quick actions";
  };

  // Group results by kind for section headers
  const sections: { label: string; items: (PaletteResult & { globalIdx: number })[] }[] = [];
  let lastKind: ResultKind | null = null;
  let globalIdx = 0;
  for (const r of results) {
    if (r.kind !== lastKind) {
      sections.push({ label: sectionLabel(r.kind), items: [] });
      lastKind = r.kind;
    }
    sections[sections.length - 1].items.push({ ...r, globalIdx: globalIdx++ });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <Search size={16} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations, templates, projects…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
          <kbd className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500 italic">No results</li>
          )}
          {sections.map((section) => (
            <li key={section.label}>
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {section.label}
              </p>
              <ul>
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={item.onExecute}
                      onMouseEnter={() => setActiveIdx(item.globalIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        item.globalIdx === activeIdx ? "bg-slate-700/80" : "hover:bg-slate-800"
                      )}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{item.label}</p>
                        {item.sublabel && (
                          <p className="text-[11px] text-slate-500 truncate">{item.sublabel}</p>
                        )}
                      </div>
                      <ArrowRight size={12} className={cn("text-slate-600 shrink-0 transition-opacity", item.globalIdx === activeIdx ? "opacity-100" : "opacity-0")} />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-700 text-[10px] text-slate-600">
          <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">↑↓</kbd> navigate</span>
          <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">↵</kbd> select</span>
          <span><kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
