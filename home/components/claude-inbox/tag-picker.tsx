"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/claude-inbox/sync/types";
import { createTag } from "@/lib/claude-inbox/data/conversations";

const TAG_COLORS = [
  { label: "Red", hex: "#ef4444" },
  { label: "Orange", hex: "#f97316" },
  { label: "Yellow", hex: "#eab308" },
  { label: "Green", hex: "#22c55e" },
  { label: "Teal", hex: "#14b8a6" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Purple", hex: "#a855f7" },
  { label: "Pink", hex: "#ec4899" },
];

interface TagPickerProps {
  userId: string;
  allTags: Tag[];
  selectedTagIds: string[];
  onToggle: (tagId: string, checked: boolean) => void;
  onClose: () => void;
  align?: "left" | "right";
}

export function TagPicker({
  userId,
  allTags,
  selectedTagIds,
  onToggle,
  onClose,
  align = "left",
}: TagPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[5].hex); // blue default

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const id = await createTag(userId, name, newColor);
    onToggle(id, true);
    setNewName("");
    setCreating(false);
  }

  return (
    <div
      ref={ref}
      className={cn("absolute z-50 mt-1 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 text-sm", align === "right" ? "right-0" : "left-0")}
    >
      <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 py-1.5">
        Tags
      </p>

      {allTags.length === 0 && !creating && (
        <p className="px-3 py-2 text-xs text-slate-500">No tags yet.</p>
      )}

      {allTags.map((tag) => {
        const checked = selectedTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id, !checked)}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: tag.color }}
            />
            <span className="flex-1 text-left text-slate-200 truncate">
              {tag.name}
            </span>
            {checked && <span className="text-indigo-400 text-xs">✓</span>}
          </button>
        );
      })}

      {creating ? (
        <div className="px-3 py-2 space-y-2 border-t border-slate-700 mt-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Tag name…"
            className="w-full bg-slate-700 text-slate-100 text-xs rounded-md px-2 py-1.5 outline-none placeholder:text-slate-500"
          />
          <div className="flex gap-1.5 flex-wrap">
            {TAG_COLORS.map(({ hex, label }) => (
              <button
                key={hex}
                onClick={() => setNewColor(hex)}
                title={label}
                aria-label={label}
                className={cn(
                  "w-5 h-5 rounded-full transition-transform",
                  newColor === hex ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-800" : ""
                )}
                style={{ background: hex }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-1 rounded-md transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200 border-t border-slate-700 mt-1"
        >
          <Plus size={12} />
          <span className="text-xs">New tag</span>
        </button>
      )}
    </div>
  );
}
