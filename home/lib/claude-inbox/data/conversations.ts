"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/claude-inbox/sync/db";
import { enqueue } from "@/lib/claude-inbox/sync/outbox";
import type { Conversation, ConversationStatus, TextBlock } from "@/lib/claude-inbox/sync/types";
import { DEFAULT_MODEL_ID } from "@/lib/claude-inbox/config/models";

export interface ConversationWithPreview {
  conversation: Conversation;
  previewText: string;
  previewRole: "user" | "assistant" | null;
}

export function useConversationList(
  userId: string,
  status: ConversationStatus,
  projectId?: string | null
): ConversationWithPreview[] | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const convs = await db.conversations
      .where("user_id")
      .equals(userId)
      .filter(
        (c) =>
          c.status === status &&
          (projectId == null || c.project_id === projectId)
      )
      .toArray();

    convs.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return Promise.all(
      convs.map(async (conv) => {
        const msgs = await db.messages
          .where("conversation_id")
          .equals(conv.id)
          .toArray();
        msgs.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const last = msgs[0];
        let previewText = "";
        let previewRole: "user" | "assistant" | null = null;
        if (last) {
          previewRole = last.role as "user" | "assistant";
          const block = last.content.find((b) => b.type === "text") as
            | TextBlock
            | undefined;
          if (block) previewText = block.text;
        }
        return { conversation: conv, previewText, previewRole };
      })
    );
  }, [userId, status, projectId]);
}

export function useConversation(id: string | null): Conversation | undefined {
  return useLiveQuery(
    () => (id ? getDB().conversations.get(id) : undefined),
    [id]
  );
}

export function useTagList(userId: string) {
  return useLiveQuery(
    () => getDB().tags.where("user_id").equals(userId).toArray(),
    [userId]
  );
}

export function useConversationsByTag(
  userId: string,
  tagId: string | null
): ConversationWithPreview[] | undefined {
  return useLiveQuery(async () => {
    if (!tagId) return [];
    const db = getDB();
    const convs = await db.conversations
      .where("user_id")
      .equals(userId)
      .filter((c) => c.tags.includes(tagId))
      .toArray();

    convs.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return Promise.all(
      convs.map(async (conv) => {
        const msgs = await db.messages
          .where("conversation_id")
          .equals(conv.id)
          .toArray();
        msgs.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const last = msgs[0];
        let previewText = "";
        let previewRole: "user" | "assistant" | null = null;
        if (last) {
          previewRole = last.role as "user" | "assistant";
          const block = last.content.find((b) => b.type === "text") as
            | TextBlock
            | undefined;
          if (block) previewText = block.text;
        }
        return { conversation: conv, previewText, previewRole };
      })
    );
  }, [userId, tagId]);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createConversation(
  userId: string,
  model?: string,
  opts?: { forked_from?: string; project_id?: string }
): Promise<string> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const conv: Conversation = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    project_id: opts?.project_id ?? null,
    provider: "anthropic",
    model: model ?? DEFAULT_MODEL_ID,
    title: null,
    system_prompt: null,
    tags: [],
    status: "inbox",
    snoozed_until: null,
    pinned: false,
    pinned_at: null,
    pinned_skills: [],
    excluded_skills: [],
    pinned_mcp_servers: [],
    excluded_mcp_servers: [],
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost_usd: 0,
    context_tokens_used: 0,
    forked_from: opts?.forked_from ?? null,
    missive_id: null,
    missive_messages_count: null,
  };
  await db.conversations.add(conv);
  await enqueue("SB-conversations", "upsert", id, conv);
  return id;
}

export async function updateConversation(
  id: string,
  patch: Partial<Conversation>
): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();
  await db.conversations.update(id, { ...patch, updated_at: now });
  const full = await db.conversations.get(id);
  if (full) await enqueue("SB-conversations", "upsert", id, full);
}

export async function archiveConversation(id: string) {
  await updateConversation(id, { status: "archived" });
}

export async function restoreConversation(id: string) {
  await updateConversation(id, { status: "inbox" });
}

export async function snoozeConversation(id: string, until: Date) {
  await updateConversation(id, {
    status: "snoozed",
    snoozed_until: until.toISOString(),
  });
}

export async function pinConversation(id: string, pinned: boolean) {
  await updateConversation(id, {
    pinned,
    pinned_at: pinned ? new Date().toISOString() : null,
  });
}

export async function setConversationTags(id: string, tags: string[]) {
  await updateConversation(id, { tags });
}

export async function deleteConversation(id: string) {
  const db = getDB();
  await db.messages.where("conversation_id").equals(id).delete();
  await db.conversations.delete(id);
  await enqueue("SB-conversations", "delete", id, {});
}

export async function bulkArchive(ids: string[]) {
  await Promise.all(ids.map(archiveConversation));
}

export async function getNextInboxConversation(
  userId: string,
  currentId: string,
  projectFilter?: string | null
): Promise<string | null> {
  const db = getDB();
  const convs = await db.conversations
    .where("user_id")
    .equals(userId)
    .filter(
      (c) =>
        c.status === "inbox" &&
        c.id !== currentId &&
        (projectFilter == null || c.project_id === projectFilter)
    )
    .toArray();
  convs.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  return convs[0]?.id ?? null;
}

export async function bulkDelete(ids: string[]) {
  await Promise.all(ids.map(deleteConversation));
}

// ── Tag mutations ─────────────────────────────────────────────────────────────

export async function createTag(
  userId: string,
  name: string,
  color: string
): Promise<string> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const tag = { id, user_id: userId, created_at: now, updated_at: now, name, color };
  await db.tags.add(tag);
  await enqueue("SB-tags", "upsert", id, tag);
  return id;
}

export async function deleteTag(id: string) {
  const db = getDB();
  await db.tags.delete(id);
  await enqueue("SB-tags", "delete", id, {});
}
