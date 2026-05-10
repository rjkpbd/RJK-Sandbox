"use client";

import { getDB } from "@/lib/claude-inbox/sync/db";
import { enqueue } from "@/lib/claude-inbox/sync/outbox";
import type { Message, MessageRole, MessageUsage, TextBlock } from "@/lib/claude-inbox/sync/types";

export async function loadMessages(conversationId: string): Promise<Message[]> {
  const db = getDB();
  const msgs = await db.messages
    .where("conversation_id")
    .equals(conversationId)
    .toArray();
  return msgs.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export async function saveMessage(
  userId: string,
  conversationId: string,
  role: MessageRole,
  text: string,
  usage?: MessageUsage,
  modelUsed?: string
): Promise<string> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const textBlock: TextBlock = { type: "text", text };
  const msg: Message = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    conversation_id: conversationId,
    role,
    content: [textBlock],
    timestamp: now,
    activated_skills: [],
    model_used: modelUsed ?? null,
    usage: usage ?? null,
    previous_versions: [],
    attachments: [],
  };
  await db.messages.add(msg);
  await enqueue("SB-messages", "upsert", id, msg);
  return id;
}

export async function updateMessageContent(
  id: string,
  text: string,
  usage?: MessageUsage
): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();
  const textBlock: TextBlock = { type: "text", text };
  // Cast to unknown to work around Dexie's deep-mapped type hitting the
  // circular Message.previous_versions: Message[] field.
  const patch: Record<string, unknown> = {
    content: [textBlock],
    updated_at: now,
    ...(usage ? { usage } : {}),
  };
  // Dexie's UpdateSpec<T> can't handle Message.previous_versions: Message[]
  // (circular self-reference), so we cast the table to escape the mapped type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.messages as any).update(id, patch);
  const full = await db.messages.get(id);
  if (full) await enqueue("SB-messages", "upsert", id, full);
}

/** Extract plain text from a Message for display. */
export function messageTextContent(msg: Message): string {
  const block = msg.content.find((b) => b.type === "text") as TextBlock | undefined;
  return block?.text ?? "";
}

export async function deleteAllMessages(conversationId: string): Promise<void> {
  const db = getDB();
  const ids = await db.messages
    .where("conversation_id")
    .equals(conversationId)
    .primaryKeys() as string[];
  await db.messages.where("conversation_id").equals(conversationId).delete();
  await Promise.all(ids.map((id) => enqueue("SB-messages", "delete", id, {})));
}

export async function cloneMessages(
  messages: Message[],
  newConversationId: string,
  userId: string
): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();
  const cloned: Message[] = messages.map((m) => ({
    ...m,
    id: crypto.randomUUID(),
    user_id: userId,
    conversation_id: newConversationId,
    created_at: now,
    updated_at: now,
  }));
  await db.messages.bulkAdd(cloned);
  await Promise.all(
    cloned.map((m) => enqueue("SB-messages", "upsert", m.id, m))
  );
}
