"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/claude-inbox/sync/db";
import { enqueue } from "@/lib/claude-inbox/sync/outbox";
import type { Template } from "@/lib/claude-inbox/sync/types";

function extractVariables(body: string): string[] {
  const vars = new Set<string>();
  for (const m of body.matchAll(/\{\{(\w+)\}\}/g)) vars.add(m[1]);
  return Array.from(vars);
}

export function useTemplates(userId: string): Template[] | undefined {
  return useLiveQuery(
    () =>
      getDB()
        .templates.where("user_id")
        .equals(userId)
        .toArray()
        .then((ts) =>
          ts.sort((a, b) => b.usage_count - a.usage_count || a.name.localeCompare(b.name))
        ),
    [userId]
  );
}

export async function createTemplate(
  userId: string,
  data: {
    name: string;
    body: string;
    default_project_id?: string | null;
    default_model?: string | null;
  }
): Promise<string> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const template: Template = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    name: data.name.replace(/^\/+/, ""),
    body: data.body,
    variables: extractVariables(data.body),
    default_project_id: data.default_project_id ?? null,
    default_model: data.default_model ?? null,
    default_skills: [],
    usage_count: 0,
  };
  await db.templates.add(template);
  await enqueue("SB-templates", "upsert", id, template);
  return id;
}

export async function updateTemplate(
  id: string,
  data: {
    name: string;
    body: string;
    default_project_id?: string | null;
    default_model?: string | null;
  }
): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();
  await db.templates.update(id, {
    name: data.name.replace(/^\/+/, ""),
    body: data.body,
    variables: extractVariables(data.body),
    default_project_id: data.default_project_id ?? null,
    default_model: data.default_model ?? null,
    updated_at: now,
  });
  const full = await db.templates.get(id);
  if (full) await enqueue("SB-templates", "upsert", id, full);
}

export async function deleteTemplate(id: string): Promise<void> {
  await getDB().templates.delete(id);
  await enqueue("SB-templates", "delete", id, {});
}

export async function incrementTemplateUsage(id: string): Promise<void> {
  const db = getDB();
  const t = await db.templates.get(id);
  if (!t) return;
  const updated = { usage_count: (t.usage_count ?? 0) + 1, updated_at: new Date().toISOString() };
  await db.templates.update(id, updated);
  const full = await db.templates.get(id);
  if (full) await enqueue("SB-templates", "upsert", id, full);
}
