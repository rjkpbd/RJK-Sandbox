import { getDB } from "@/lib/claude-inbox/sync/db";
import { archiveConversation } from "@/lib/claude-inbox/data/conversations";

/**
 * Archives inbox conversations that have not been updated in `afterDays` days.
 * Pinned conversations are never auto-archived.
 * Returns the number of conversations archived.
 */
export async function runAutoArchive(userId: string, afterDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - afterDays);
  const cutoffStr = cutoff.toISOString();

  const toArchive = await getDB()
    .conversations.where("user_id")
    .equals(userId)
    .filter((c) => c.status === "inbox" && !c.pinned && c.updated_at < cutoffStr)
    .toArray();

  if (toArchive.length === 0) return 0;
  await Promise.all(toArchive.map((c) => archiveConversation(c.id)));
  return toArchive.length;
}
