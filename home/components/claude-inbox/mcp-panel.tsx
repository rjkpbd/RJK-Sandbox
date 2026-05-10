"use client";

import { useState } from "react";
import { Server, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateConversation } from "@/lib/claude-inbox/data/conversations";
import type { McpServer } from "@/lib/claude-inbox/sync/types";

interface McpPanelProps {
  conversationId: string;
  allServers: McpServer[];
  pinnedMcpIds: string[];
  excludedMcpIds: string[];
}

export function McpPanel({ conversationId, allServers, pinnedMcpIds, excludedMcpIds }: McpPanelProps) {
  const [open, setOpen] = useState(false);

  if (allServers.length === 0) return null;

  const activeCount = allServers.filter((s) => {
    if (excludedMcpIds.includes(s.id)) return false;
    return s.enabled || pinnedMcpIds.includes(s.id);
  }).length;

  function toggle(serverId: string) {
    const server = allServers.find((s) => s.id === serverId);
    if (!server) return;

    if (excludedMcpIds.includes(serverId)) {
      updateConversation(conversationId, {
        excluded_mcp_servers: excludedMcpIds.filter((id) => id !== serverId),
      });
    } else if (!server.enabled && !pinnedMcpIds.includes(serverId)) {
      updateConversation(conversationId, {
        pinned_mcp_servers: [...pinnedMcpIds, serverId],
      });
    } else if (server.enabled) {
      updateConversation(conversationId, {
        excluded_mcp_servers: [...excludedMcpIds, serverId],
      });
    } else if (pinnedMcpIds.includes(serverId)) {
      updateConversation(conversationId, {
        pinned_mcp_servers: pinnedMcpIds.filter((id) => id !== serverId),
      });
    }
  }

  return (
    <div className="shrink-0 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="MCP servers"
        className={cn(
          "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
          activeCount > 0
            ? open ? "text-emerald-400 bg-slate-700" : "text-emerald-400 hover:bg-slate-700"
            : open ? "text-slate-400 bg-slate-700" : "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
        )}
      >
        <Server size={13} />
        <span className="hidden sm:inline">MCP</span>
        {activeCount > 0 && (
          <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1 rounded-full">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              MCP servers for this conversation
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Enable servers globally in Settings → MCP
            </p>
          </div>
          <ul className="py-1 max-h-60 overflow-y-auto">
            {allServers.map((server) => {
              const isPinned = pinnedMcpIds.includes(server.id);
              const isExcluded = excludedMcpIds.includes(server.id);
              const isActive = !isExcluded && (server.enabled || isPinned);

              return (
                <li key={server.id}>
                  <button
                    onClick={() => toggle(server.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/60 transition-colors text-left"
                  >
                    <div className={cn(
                      "w-5 h-5 rounded flex items-center justify-center shrink-0",
                      isActive ? "bg-emerald-500/20" : "bg-slate-700"
                    )}>
                      <Server size={10} className={isActive ? "text-emerald-400" : "text-slate-600"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs truncate", isActive ? "text-slate-200" : "text-slate-500")}>
                        {server.name}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {isExcluded ? "Excluded this chat" : isPinned ? "Pinned this chat" : server.enabled ? "On by default" : "Off by default"}
                      </p>
                    </div>
                    {isPinned && <Pin size={10} className="text-emerald-400 shrink-0" />}
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
