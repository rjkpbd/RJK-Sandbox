import type { SupabaseClient } from "@supabase/supabase-js";
import { getDB } from "./db";
import { updateSyncState } from "./status";
import type { OutboxOperation } from "./types";

const MAX_RETRIES = 5;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

export async function enqueue(
  table: string,
  operation: OutboxOperation,
  recordId: string,
  payload: unknown
): Promise<void> {
  const db = getDB();
  await db._outbox.add({
    table,
    operation,
    record_id: recordId,
    payload,
    queued_at: new Date().toISOString(),
    retry_count: 0,
  });
  const count = await db._outbox.count();
  updateSyncState({ pendingCount: count });
}

export async function flushOutbox(supabase: SupabaseClient): Promise<void> {
  const db = getDB();
  const items = await db._outbox.orderBy("queued_at").toArray();
  if (items.length === 0) return;

  updateSyncState({ status: "syncing" });

  for (const item of items) {
    if (item.retry_count >= MAX_RETRIES) {
      await db._outbox.delete(item.id!);
      continue;
    }

    try {
      if (item.operation === "upsert") {
        const { error } = await supabase
          .from(item.table)
          .upsert(item.payload as Record<string, unknown>);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(item.table)
          .delete()
          .eq("id", item.record_id);
        if (error) throw error;
      }
      await db._outbox.delete(item.id!);
    } catch (err) {
      const delay = BACKOFF_MS[Math.min(item.retry_count, BACKOFF_MS.length - 1)];
      const jitter = Math.random() * delay * 0.2;
      await new Promise((r) => setTimeout(r, delay + jitter));

      await db._outbox.update(item.id!, {
        retry_count: item.retry_count + 1,
        last_error: String(err),
      });
    }
  }

  const remaining = await db._outbox.count();
  updateSyncState({
    pendingCount: remaining,
    status: remaining === 0 ? "idle" : "error",
    lastSyncedAt: new Date().toISOString(),
  });
}
