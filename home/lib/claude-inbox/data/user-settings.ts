"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/claude-inbox/sync/db";
import { enqueue } from "@/lib/claude-inbox/sync/outbox";
import type { UserSettings } from "@/lib/claude-inbox/sync/types";
import { DEFAULT_MODEL_ID } from "@/lib/claude-inbox/config/models";

function defaultSettings(userId: string): UserSettings {
  const now = new Date().toISOString();
  return {
    id: userId,
    user_id: userId,
    created_at: now,
    updated_at: now,
    default_model: DEFAULT_MODEL_ID,
    theme: "dark",
    encrypted_api_key: null,
    kdf_salt: null,
    kdf_iterations: 100_000,
    recovery_key_wrap: null,
    custom_instructions: null,
    daily_cost_cap_usd: null,
    monthly_cost_cap_usd: null,
    per_conversation_cap_usd: null,
    auto_archive_days: null,
    web_search_enabled: false,
    web_search_max_per_turn: 3,
    allowed_domains: [],
    blocked_domains: [],
    mcp_audit_retention_days: 30,
    debug_mode: false,
  };
}

export function useUserSettings(userId: string): UserSettings | undefined {
  return useLiveQuery(
    () => getDB().user_settings.where("user_id").equals(userId).first(),
    [userId]
  );
}

export async function getOrCreateUserSettings(userId: string): Promise<UserSettings> {
  const db = getDB();
  const existing = await db.user_settings.where("user_id").equals(userId).first();
  if (existing) return existing;
  const settings = defaultSettings(userId);
  await db.user_settings.add(settings);
  await enqueue("SB-user_settings", "upsert", settings.id, settings);
  return settings;
}

export async function updateUserSettings(
  userId: string,
  patch: Partial<UserSettings>
): Promise<void> {
  const settings = await getOrCreateUserSettings(userId);
  const db = getDB();
  const now = new Date().toISOString();
  await db.user_settings.update(settings.id, { ...patch, updated_at: now });
  const full = await db.user_settings.get(settings.id);
  if (full) await enqueue("SB-user_settings", "upsert", settings.id, full);
}
