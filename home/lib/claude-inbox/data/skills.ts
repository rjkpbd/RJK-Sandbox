"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/claude-inbox/sync/db";
import { enqueue } from "@/lib/claude-inbox/sync/outbox";
import type { Skill } from "@/lib/claude-inbox/sync/types";

export function useSkills(userId: string): Skill[] | undefined {
  return useLiveQuery(
    () =>
      getDB()
        .skills.where("user_id")
        .equals(userId)
        .toArray()
        .then((s) => s.sort((a, b) => a.name.localeCompare(b.name))),
    [userId]
  );
}

export function useEnabledSkills(userId: string): Skill[] | undefined {
  return useLiveQuery(
    () =>
      getDB()
        .skills.where("user_id")
        .equals(userId)
        .filter((s) => s.enabled)
        .toArray()
        .then((s) => s.sort((a, b) => a.name.localeCompare(b.name))),
    [userId]
  );
}

export async function createSkill(
  userId: string,
  data: {
    name: string;
    description?: string;
    body: string;
    version?: string;
    source?: Skill["source"];
    source_url?: string;
    allowed_tools?: string[];
  }
): Promise<string> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const skill: Skill = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    name: data.name,
    description: data.description ?? null,
    version: data.version ?? "1.0.0",
    body: data.body,
    allowed_tools: data.allowed_tools ?? [],
    files: [],
    enabled: true,
    source: data.source ?? "paste",
    source_url: data.source_url ?? null,
    version_history: [],
  };
  await db.skills.add(skill);
  await enqueue("SB-skills", "upsert", id, skill);
  return id;
}

export async function updateSkill(
  id: string,
  data: {
    name?: string;
    description?: string;
    body?: string;
    version?: string;
    allowed_tools?: string[];
  }
): Promise<void> {
  const db = getDB();
  const existing = await db.skills.get(id);
  if (!existing) return;

  // Archive current body to version_history (keep last 5)
  const historyEntry =
    data.body && data.body !== existing.body
      ? { version: existing.version, body: existing.body, saved_at: new Date().toISOString() }
      : null;

  const history = historyEntry
    ? [...(existing.version_history as object[]).slice(-4), historyEntry]
    : existing.version_history;

  const now = new Date().toISOString();
  await db.skills.update(id, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.body !== undefined ? { body: data.body } : {}),
    ...(data.version !== undefined ? { version: data.version } : {}),
    ...(data.allowed_tools !== undefined ? { allowed_tools: data.allowed_tools } : {}),
    version_history: history,
    updated_at: now,
  });
  const full = await db.skills.get(id);
  if (full) await enqueue("SB-skills", "upsert", id, full);
}

export async function toggleSkill(id: string, enabled: boolean): Promise<void> {
  const db = getDB();
  await db.skills.update(id, { enabled, updated_at: new Date().toISOString() });
  const full = await db.skills.get(id);
  if (full) await enqueue("SB-skills", "upsert", id, full);
}

export async function deleteSkill(id: string): Promise<void> {
  await getDB().skills.delete(id);
  await enqueue("SB-skills", "delete", id, {});
}

/** Fetch skill body from a public GitHub URL (raw content). */
export async function fetchSkillFromGitHub(url: string): Promise<string> {
  // Convert github.com URLs to raw.githubusercontent.com
  const rawUrl = url
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
    .replace("/blob/", "/");

  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  return res.text();
}
