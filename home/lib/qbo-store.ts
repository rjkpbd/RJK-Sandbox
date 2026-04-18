import { createServerClient } from "@/lib/supabase-server";

export interface QBORecord {
  realm_id: string;
  refresh_token: string;
  refresh_token_expires_at: string; // ISO string
}

export async function getQBORecord(userId: string): Promise<QBORecord | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("qbo_connections")
    .select("realm_id, refresh_token, refresh_token_expires_at")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as QBORecord;
}

export async function upsertQBORecord(
  userId: string,
  record: QBORecord
): Promise<void> {
  const db = createServerClient();
  await db.from("qbo_connections").upsert(
    { user_id: userId, ...record, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}

export async function deleteQBORecord(userId: string): Promise<void> {
  const db = createServerClient();
  await db.from("qbo_connections").delete().eq("user_id", userId);
}
