import type { SupabaseClient } from "@supabase/supabase-js";
import { getDB } from "./db";
import { updateSyncState } from "./status";

const REALTIME_TABLES = [
  { supabase: "SB-user_settings", dexie: "user_settings" },
  { supabase: "SB-devices", dexie: "devices" },
  { supabase: "SB-projects", dexie: "projects" },
  { supabase: "SB-conversations", dexie: "conversations" },
  { supabase: "SB-messages", dexie: "messages" },
  { supabase: "SB-tags", dexie: "tags" },
  { supabase: "SB-skills", dexie: "skills" },
  { supabase: "SB-mcp_servers", dexie: "mcp_servers" },
  { supabase: "SB-templates", dexie: "templates" },
] as const;

export function startRealtimeSync(
  supabase: SupabaseClient,
  userId: string
): () => void {
  const db = getDB();

  const channel = supabase.channel(`inbox-user-${userId}`);

  for (const { supabase: table, dexie: store } of REALTIME_TABLES) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        updateSyncState({ status: "syncing" });
        try {
          const dexieTable = (db as unknown as Record<string, import("dexie").Table>)[store];

          if (payload.eventType === "DELETE") {
            const old = payload.old as Record<string, unknown>;
            if (old.id) await dexieTable.delete(old.id as string);
          } else {
            const record = payload.new as Record<string, unknown>;
            if (record.id) await dexieTable.put(record);
          }

          updateSyncState({
            status: "idle",
            lastSyncedAt: new Date().toISOString(),
          });
        } catch (err) {
          updateSyncState({ status: "error", error: String(err) });
        }
      }
    );
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      updateSyncState({ status: "idle" });
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      updateSyncState({ status: "offline" });
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}
