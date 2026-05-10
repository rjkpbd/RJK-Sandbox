"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB, type McpAuditEntry } from "@/lib/claude-inbox/sync/db";
import { enqueue } from "@/lib/claude-inbox/sync/outbox";
import type { McpServer, ToolApprovalMode } from "@/lib/claude-inbox/sync/types";

export function useMcpServers(userId: string): McpServer[] | undefined {
  return useLiveQuery(
    () =>
      getDB()
        .mcp_servers.where("user_id")
        .equals(userId)
        .toArray()
        .then((s) => s.sort((a, b) => a.name.localeCompare(b.name))),
    [userId]
  );
}

export function useMcpAuditLog(
  userId: string,
  limit = 50
): McpAuditEntry[] | undefined {
  return useLiveQuery(
    () =>
      getDB()
        .mcp_audit_log.where("user_id")
        .equals(userId)
        .reverse()
        .limit(limit)
        .toArray(),
    [userId, limit]
  );
}

export async function createMcpServer(
  userId: string,
  data: {
    name: string;
    url: string;
    transport: McpServer["transport"];
    auth_type: McpServer["auth_type"];
    oauth_metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const server: McpServer = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    name: data.name,
    url: data.url,
    transport: data.transport,
    auth_type: data.auth_type,
    encrypted_token: null,
    encrypted_refresh_token: null,
    oauth_metadata: data.oauth_metadata ?? null,
    enabled: true,
    tools_cache: [],
    tool_approval_modes: {},
    last_connected_at: null,
    status: "disconnected",
  };
  await db.mcp_servers.add(server);
  await enqueue("SB-mcp_servers", "upsert", id, server);
  return id;
}

export async function updateMcpServer(
  id: string,
  patch: Partial<McpServer>
): Promise<void> {
  const db = getDB();
  await db.mcp_servers.update(id, { ...patch, updated_at: new Date().toISOString() });
  const full = await db.mcp_servers.get(id);
  if (full) await enqueue("SB-mcp_servers", "upsert", id, full);
}

export async function deleteMcpServer(id: string): Promise<void> {
  await getDB().mcp_servers.delete(id);
  await enqueue("SB-mcp_servers", "delete", id, {});
}

export async function toggleMcpServer(id: string, enabled: boolean): Promise<void> {
  await updateMcpServer(id, { enabled, status: enabled ? "disconnected" : "disabled" });
}

export async function setToolApprovalMode(
  serverId: string,
  toolName: string,
  mode: ToolApprovalMode
): Promise<void> {
  const db = getDB();
  const server = await db.mcp_servers.get(serverId);
  if (!server) return;
  const tool_approval_modes = { ...server.tool_approval_modes, [toolName]: mode };
  await updateMcpServer(serverId, { tool_approval_modes });
}

export async function storeMcpToken(
  serverId: string,
  accessToken: string,
  refreshToken?: string
): Promise<void> {
  await updateMcpServer(serverId, {
    encrypted_token: accessToken,
    encrypted_refresh_token: refreshToken ?? null,
    status: "connected",
    last_connected_at: new Date().toISOString(),
  });
}

export async function logAuditEntry(
  entry: Omit<McpAuditEntry, "id">
): Promise<void> {
  const db = getDB();
  await db.mcp_audit_log.add(entry);

  // Enforce retention: delete entries older than retention period
  // (retention_days loaded from UserSettings; default 30)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  await db.mcp_audit_log
    .where("timestamp")
    .below(cutoff.toISOString())
    .delete();
}

export async function clearAuditLog(userId: string): Promise<void> {
  await getDB().mcp_audit_log.where("user_id").equals(userId).delete();
}

export async function refreshMcpTools(
  serverId: string
): Promise<{ count: number } | { error: string }> {
  const db = getDB();
  const server = await db.mcp_servers.get(serverId);
  if (!server) return { error: "Server not found" };

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  let res: Response;
  try {
    res = await fetch("/api/claude-inbox/mcp-tools", {
      method: "POST",
      headers,
      body: JSON.stringify({
        serverUrl: server.url,
        authToken: server.encrypted_token ?? undefined,
      }),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }

  const data = await res.json() as { tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>; error?: string };

  if (!res.ok || data.error) {
    return { error: data.error ?? `Server error ${res.status}` };
  }

  await updateMcpServer(serverId, {
    tools_cache: data.tools ?? [],
    status: "connected",
    last_connected_at: new Date().toISOString(),
  });

  return { count: (data.tools ?? []).length };
}
