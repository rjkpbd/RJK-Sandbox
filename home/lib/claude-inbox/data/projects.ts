"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/claude-inbox/sync/db";
import { enqueue } from "@/lib/claude-inbox/sync/outbox";
import type { Project } from "@/lib/claude-inbox/sync/types";

export function useProjects(userId: string): Project[] | undefined {
  return useLiveQuery(
    () =>
      getDB()
        .projects.where("user_id")
        .equals(userId)
        .toArray()
        .then((p) => p.sort((a, b) => a.name.localeCompare(b.name))),
    [userId]
  );
}

export function useProject(id: string | null): Project | undefined {
  return useLiveQuery(() => (id ? getDB().projects.get(id) : undefined), [id]);
}

export function useProjectConversationCount(projectId: string): number | undefined {
  return useLiveQuery(
    () => getDB().conversations.where("project_id").equals(projectId).count(),
    [projectId]
  );
}

export async function createProject(
  userId: string,
  data: {
    name: string;
    description?: string;
    color?: string;
    system_prompt?: string;
    default_model?: string;
  }
): Promise<string> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const project: Project = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    name: data.name,
    description: data.description ?? null,
    system_prompt: data.system_prompt ?? null,
    default_model: data.default_model ?? null,
    preferred_skills: [],
    preferred_mcp_servers: [],
    color: data.color ?? null,
    project_context: null,
  };
  await db.projects.add(project);
  await enqueue("SB-projects", "upsert", id, project);
  return id;
}

export async function updateProject(
  id: string,
  patch: Partial<Project>
): Promise<void> {
  const db = getDB();
  await db.projects.update(id, { ...patch, updated_at: new Date().toISOString() });
  const full = await db.projects.get(id);
  if (full) await enqueue("SB-projects", "upsert", id, full);
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDB();
  // Unassign conversations
  const convIds = await db.conversations
    .where("project_id")
    .equals(id)
    .primaryKeys();
  await Promise.all(
    convIds.map((cid) => db.conversations.update(cid as string, { project_id: null }))
  );
  await db.projects.delete(id);
  await enqueue("SB-projects", "delete", id, {});
}
