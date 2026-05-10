"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Server, Wifi, WifiOff, Key, ShieldCheck,
  ChevronDown, ChevronUp, ClipboardList, ToggleLeft, ToggleRight, X, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import {
  useMcpServers,
  useMcpAuditLog,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  toggleMcpServer,
  setToolApprovalMode,
  storeMcpToken,
  clearAuditLog,
  refreshMcpTools,
} from "@/lib/claude-inbox/data/mcp-servers";
import { generateVerifier, computeChallenge, generateState } from "@/lib/claude-inbox/crypto/pkce";
import { McpServerForm } from "@/components/claude-inbox/mcp-server-form";
import type { McpServer, ToolApprovalMode } from "@/lib/claude-inbox/sync/types";

const STORAGE_KEY = "mcp_oauth_pending";
const APPROVAL_MODES: ToolApprovalMode[] = ["always", "ask_once", "ask_each", "never"];
const APPROVAL_LABELS: Record<ToolApprovalMode, string> = {
  always: "Always",
  ask_once: "Ask once",
  ask_each: "Ask each",
  never: "Never",
};

function ApprovalBadge({ mode }: { mode: ToolApprovalMode }) {
  const colors: Record<ToolApprovalMode, string> = {
    always: "bg-emerald-500/20 text-emerald-400",
    ask_once: "bg-sky-500/20 text-sky-400",
    ask_each: "bg-amber-500/20 text-amber-400",
    never: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", colors[mode])}>
      {APPROVAL_LABELS[mode]}
    </span>
  );
}

function ServerCard({
  server,
  onEdit,
  onDelete,
  onToggle,
  onOAuth,
  onRefresh,
}: {
  server: McpServer;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onOAuth: () => void;
  onRefresh: () => void;
}) {
  const [showTools, setShowTools] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const isConnected = server.status === "connected";

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    const result = await refreshMcpTools(server.id);
    if ("error" in result) setRefreshError(result.error);
    else onRefresh();
    setRefreshing(false);
  }

  return (
    <div className={cn(
      "bg-slate-800 border rounded-xl overflow-hidden flex flex-col",
      server.enabled ? "border-slate-700" : "border-slate-700/50 opacity-60"
    )}>
      <div className={cn("h-1 shrink-0", isConnected ? "bg-emerald-500" : server.enabled ? "bg-amber-500" : "bg-slate-600")} />

      <div className="p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", isConnected ? "bg-emerald-500/20" : "bg-slate-700")}>
              <Server size={14} className={isConnected ? "text-emerald-400" : "text-slate-500"} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{server.name}</p>
              <p className="text-[11px] text-slate-500 font-mono truncate">{server.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {isConnected
              ? <Wifi size={13} className="text-emerald-400 mr-1" />
              : <WifiOff size={13} className="text-slate-600 mr-1" />}
            <button onClick={onToggle} title={server.enabled ? "Disable" : "Enable"} className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
              {server.enabled ? <ToggleRight size={14} className="text-indigo-400" /> : <ToggleLeft size={14} />}
            </button>
            <button onClick={onEdit} title="Edit" className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} title="Delete" className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded uppercase">{server.transport}</span>
          <span className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded", server.auth_type === "oauth" ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-700 text-slate-400")}>
            {server.auth_type === "oauth" ? <ShieldCheck size={9} /> : <Key size={9} />}
            {server.auth_type === "oauth" ? "OAuth 2.1" : "Bearer"}
          </span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500")}>
            {server.status}
          </span>
        </div>

        {/* OAuth connect button */}
        {server.auth_type === "oauth" && !isConnected && server.enabled && (
          <button
            onClick={onOAuth}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 justify-center"
          >
            <ShieldCheck size={12} />
            Connect with OAuth
          </button>
        )}

        {/* Tools / approval modes */}
        <div className="border-t border-slate-700/60 pt-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            {server.tools_cache.length > 0 ? (
              <button
                onClick={() => setShowTools((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showTools ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {server.tools_cache.length} tool{server.tools_cache.length !== 1 ? "s" : ""}
              </button>
            ) : (
              <p className="text-[11px] text-slate-600 italic">No tools discovered</p>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Discover tools from server"
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh tools"}
            </button>
          </div>
          {refreshError && <p className="text-[10px] text-red-400">{refreshError}</p>}
          {showTools && server.tools_cache.length > 0 && (
            <div className="flex flex-col gap-1">
              {server.tools_cache.map((tool) => {
                const current: ToolApprovalMode = server.tool_approval_modes[tool.name] ?? "ask_each";
                const nextMode = APPROVAL_MODES[(APPROVAL_MODES.indexOf(current) + 1) % APPROVAL_MODES.length];
                return (
                  <div key={tool.name} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400 font-mono truncate flex-1">{tool.name}</p>
                    <button
                      onClick={() => setToolApprovalMode(server.id, tool.name, nextMode)}
                      title={`Approval: ${APPROVAL_LABELS[current]} — click to change`}
                    >
                      <ApprovalBadge mode={current} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function McpPage() {
  const router = useRouter();
  const { userId } = useSyncContext();
  const servers = useMcpServers(userId);
  const auditLog = useMcpAuditLog(userId, 30);
  const [editing, setEditing] = useState<McpServer | null | "new">(null);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && editing === null) router.push("/claude-inbox/inbox");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, editing]);

  async function handleSave(data: Parameters<typeof createMcpServer>[1] & { bearer_token?: string }) {
    if (editing === "new") {
      const id = await createMcpServer(userId, data);
      if (data.bearer_token) await storeMcpToken(id, data.bearer_token);
      // Fire-and-forget tool discovery so the new server has tools immediately
      refreshMcpTools(id).catch(() => {});
    } else if (editing) {
      const { bearer_token, ...rest } = data;
      await updateMcpServer(editing.id, rest);
      if (bearer_token) await storeMcpToken(editing.id, bearer_token);
      refreshMcpTools(editing.id).catch(() => {});
    }
    setEditing(null);
  }

  const handleOAuth = useCallback(async (server: McpServer) => {
    const meta = server.oauth_metadata as {
      client_id?: string;
      authorization_url?: string;
      token_url?: string;
      scope?: string;
    } | null;

    if (!meta?.authorization_url || !meta?.client_id || !meta?.token_url) {
      alert("OAuth metadata incomplete. Please edit the server and fill in all OAuth fields.");
      return;
    }

    const verifier = generateVerifier();
    const challenge = await computeChallenge(verifier);
    const state = generateState();
    const redirectUri = `${window.location.origin}/claude-inbox/mcp/callback`;

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      state,
      verifier,
      serverId: server.id,
      tokenUrl: meta.token_url,
      clientId: meta.client_id,
      redirectUri,
    }));

    const authUrl = new URL(meta.authorization_url);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", meta.client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", meta.scope ?? "");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    window.location.href = authUrl.toString();
  }, []);

  const isLoading = servers === undefined;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">MCP Servers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Model Context Protocol servers extend Claude with external tools.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudit((v) => !v)}
            className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors", showAudit ? "bg-slate-700 border-slate-600 text-slate-200" : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600")}
          >
            <ClipboardList size={13} />
            Audit log
          </button>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add server
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

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        {/* Audit log */}
        {showAudit && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <p className="text-xs font-semibold text-slate-300">Tool invocation log</p>
              <button
                onClick={() => clearAuditLog(userId)}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
            {!auditLog || auditLog.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-600 italic text-center">No tool invocations recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="px-4 py-2.5 flex items-start gap-3">
                    <span className={cn("text-[10px] shrink-0 mt-0.5 font-medium", entry.result === "approved" ? "text-emerald-400" : entry.result === "denied" ? "text-red-400" : "text-amber-400")}>
                      {entry.result}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 font-mono">{entry.server_name} / {entry.tool_name}</p>
                      {entry.input_summary && (
                        <p className="text-[10px] text-slate-600 truncate">{entry.input_summary}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Server grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl h-36 animate-pulse" />
            ))}
          </div>
        ) : servers!.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
              <Server size={24} className="text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-300">No MCP servers</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Connect Model Context Protocol servers to give Claude access to external tools, databases, and APIs.
              </p>
            </div>
            <button onClick={() => setEditing("new")} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              Add your first server
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers!.map((s) => (
              <ServerCard
                key={s.id}
                server={s}
                onEdit={() => setEditing(s)}
                onDelete={() => deleteMcpServer(s.id)}
                onToggle={() => toggleMcpServer(s.id, !s.enabled)}
                onOAuth={() => handleOAuth(s)}
                onRefresh={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {editing !== null && (
        <McpServerForm
          initial={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
