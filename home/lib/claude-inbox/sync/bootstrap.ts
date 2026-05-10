import type { SupabaseClient } from "@supabase/supabase-js";
import { getDB } from "./db";
import { updateSyncState } from "./status";

const BOOTSTRAP_STALENESS_MS = 24 * 60 * 60 * 1000; // 24 hours
const META_KEY = "lastBootstrap";

const TABLES = [
  { supabase: "SB-user_settings", dexie: "user_settings" },
  { supabase: "SB-devices", dexie: "devices" },
  { supabase: "SB-projects", dexie: "projects" },
  { supabase: "SB-tags", dexie: "tags" },
  { supabase: "SB-conversations", dexie: "conversations" },
  { supabase: "SB-messages", dexie: "messages" },
  { supabase: "SB-skills", dexie: "skills" },
  { supabase: "SB-mcp_servers", dexie: "mcp_servers" },
  { supabase: "SB-templates", dexie: "templates" },
  { supabase: "SB-pending_streams", dexie: "pending_streams" },
  { supabase: "SB-attachments", dexie: "attachments" },
] as const;

export async function needsBootstrap(): Promise<boolean> {
  const db = getDB();
  const meta = await db._meta.get(META_KEY);
  if (!meta) return true;
  const age = Date.now() - new Date(meta.value).getTime();
  return age > BOOTSTRAP_STALENESS_MS;
}

export async function bootstrapUser(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const db = getDB();

  updateSyncState({ isBootstrapping: true, bootstrapProgress: 0 });

  for (let i = 0; i < TABLES.length; i++) {
    const { supabase: table, dexie: store } = TABLES[i];
    const progress = Math.round(((i + 1) / TABLES.length) * 100);

    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      if (data && data.length > 0) {
        const dexieTable = (db as unknown as Record<string, import("dexie").Table>)[store];
        await dexieTable.bulkPut(data);
      }

      updateSyncState({ bootstrapProgress: progress });
    } catch (err) {
      updateSyncState({
        isBootstrapping: false,
        status: "error",
        error: `Bootstrap failed on ${table}: ${String(err)}`,
      });
      throw err;
    }
  }

  await db._meta.put({ key: META_KEY, value: new Date().toISOString() });

  updateSyncState({
    isBootstrapping: false,
    bootstrapProgress: 100,
    status: "idle",
    lastSyncedAt: new Date().toISOString(),
  });
}
