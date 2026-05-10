import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_MODEL_ID } from "@/lib/claude-inbox/config/models";

const MISSIVE_BASE = "https://public.missiveapp.com/v1";

// ── Missive API types ─────────────────────────────────────────────────────────

interface MissiveField {
  name: string | null;
  address: string;
}

interface MissiveAttachment {
  filename: string;
  media_type: string;
  sub_type: string;
  size: number;
  url: string;
}

interface MissiveMessage {
  id: string;
  subject: string | null;
  preview: string | null;
  type: string;
  delivered_at: number | null;
  created_at: number;
  from_field: MissiveField | null;
  to_fields: MissiveField[];
  cc_fields: MissiveField[];
  body?: string;
  attachments: MissiveAttachment[];
}

interface WebhookPayload {
  conversation: {
    id: string;
    subject: string | null;
    latest_message_subject: string | null;
    messages_count: number;
  };
  latest_message: {
    id: string;
    subject: string | null;
    preview: string | null;
    delivered_at: number | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function missiveFetch(path: string): Promise<unknown> {
  const res = await fetch(`${MISSIVE_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.MISSIVE_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Missive API ${res.status} on ${path}`);
  }
  return res.json();
}

async function fetchConversationMessages(conversationId: string): Promise<MissiveMessage[]> {
  const messages: MissiveMessage[] = [];
  let until: number | null = null;

  while (true) {
    const params = new URLSearchParams({ limit: "20" });
    if (until !== null) params.set("until", String(until));

    const data = (await missiveFetch(
      `/conversations/${conversationId}/messages?${params}`
    )) as { messages?: MissiveMessage[] };

    const batch = data.messages ?? [];
    if (batch.length === 0) break;
    messages.push(...batch);
    if (batch.length < 20) break;

    const oldest = batch[batch.length - 1];
    const oldestTs = oldest.delivered_at ?? oldest.created_at;
    if (until === oldestTs) break;
    until = oldestTs;
  }

  return messages;
}

async function fetchFullMessage(messageId: string): Promise<MissiveMessage | null> {
  try {
    const data = (await missiveFetch(`/messages/${messageId}`)) as {
      messages?: MissiveMessage;
    };
    return data.messages ?? null;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatMessageForContext(msg: MissiveMessage): string {
  const ts = msg.delivered_at ?? msg.created_at;
  const date = ts ? new Date(ts * 1000).toISOString() : "unknown date";
  const from = msg.from_field
    ? `${msg.from_field.name ?? ""} <${msg.from_field.address}>`.trim()
    : "unknown";
  const body = msg.body ? stripHtml(msg.body) : (msg.preview ?? "");
  return `From: ${from}\nDate: ${date}\n\n${body}`;
}

function buildContextBlock(
  allMessages: MissiveMessage[],
  triggeringMessageId: string,
  subject: string | null
): string | null {
  const prior = allMessages.filter((m) => m.id !== triggeringMessageId);
  if (prior.length === 0) return null;

  const parts = prior.map(formatMessageForContext).join("\n\n---\n\n");
  const header = `[Missive thread context — ${prior.length} prior message(s)]${subject ? `\nSubject: ${subject}` : ""}`;
  return `${header}\n\n${parts}`;
}

function mimeType(att: MissiveAttachment): string {
  return `${att.media_type}/${att.sub_type}`;
}

function attachmentStorageType(att: MissiveAttachment): "image" | "pdf" | "text" | null {
  if (att.media_type === "image") return "image";
  if (att.media_type === "application" && att.sub_type === "pdf") return "pdf";
  if (att.media_type === "text") return "text";
  return null; // skip unsupported types
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Validate webhook secret via query param
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.MISSIVE_WEBHOOK_SECRET || secret !== process.env.MISSIVE_WEBHOOK_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = process.env.MISSIVE_WEBHOOK_USER_ID;
  if (!userId) {
    return Response.json({ error: "MISSIVE_WEBHOOK_USER_ID not configured" }, { status: 500 });
  }
  if (!process.env.MISSIVE_API_KEY) {
    return Response.json({ error: "MISSIVE_API_KEY not configured" }, { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { conversation, latest_message } = payload;

  const supabase = createAdminClient();

  // Fetch all messages from Missive (paginated) and the full triggering message
  const [allMissiveMessages, fullTriggeringMessage] = await Promise.all([
    fetchConversationMessages(conversation.id),
    fetchFullMessage(latest_message.id),
  ]);

  const triggeringMsg = fullTriggeringMessage ?? {
    id: latest_message.id,
    subject: latest_message.subject,
    preview: latest_message.preview,
    type: "email",
    delivered_at: latest_message.delivered_at,
    created_at: latest_message.delivered_at ?? Math.floor(Date.now() / 1000),
    from_field: null,
    to_fields: [],
    cc_fields: [],
    attachments: [],
  };

  // Look up existing conversation by missive_id
  const { data: existingConv } = await supabase
    .from("SB-conversations")
    .select("id, missive_messages_count")
    .eq("missive_id", conversation.id)
    .eq("user_id", userId)
    .maybeSingle();

  let conversationId: string;
  const now = new Date().toISOString();

  if (existingConv) {
    // Skip if no new messages since last webhook
    if (conversation.messages_count <= (existingConv.missive_messages_count ?? 0)) {
      return Response.json({ ok: true, skipped: true });
    }

    conversationId = existingConv.id;

    await supabase
      .from("SB-conversations")
      .update({ missive_messages_count: conversation.messages_count, updated_at: now })
      .eq("id", conversationId);
  } else {
    // Create new conversation
    const newId = crypto.randomUUID();
    const { error: convErr } = await supabase.from("SB-conversations").insert({
      id: newId,
      user_id: userId,
      created_at: now,
      updated_at: now,
      project_id: null,
      provider: "anthropic",
      model: DEFAULT_MODEL_ID,
      title: conversation.subject || conversation.latest_message_subject || null,
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
      forked_from: null,
      missive_id: conversation.id,
      missive_messages_count: conversation.messages_count,
    });

    if (convErr) {
      return Response.json({ error: convErr.message }, { status: 500 });
    }

    conversationId = newId;
  }

  // Build message content
  const contextBlock = buildContextBlock(
    allMissiveMessages,
    latest_message.id,
    conversation.subject
  );

  const triggeringBody = triggeringMsg.body
    ? stripHtml(triggeringMsg.body)
    : (triggeringMsg.preview ?? "");

  const messageText = contextBlock
    ? `${contextBlock}\n\n================\n\nNEW MESSAGE:\n${triggeringBody}`
    : triggeringBody;

  // Process attachments from the triggering message only
  const attachmentMeta: Array<{
    id: string;
    type: "image" | "pdf" | "text";
    filename: string;
    size: number;
    storage_ref: string;
    mime_type: string;
  }> = [];

  const imageBlocks: Array<{ type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [];

  const messageId = crypto.randomUUID();

  for (const att of triggeringMsg.attachments ?? []) {
    const type = attachmentStorageType(att);
    if (!type || !att.url) continue;

    try {
      const res = await fetch(att.url);
      if (!res.ok) continue;

      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const storagePath = `${userId}/${messageId}/${att.filename}`;

      const { error: uploadErr } = await supabase.storage
        .from("attachments")
        .upload(storagePath, bytes, { contentType: mimeType(att), upsert: true });

      if (uploadErr) continue;

      const attId = crypto.randomUUID();
      attachmentMeta.push({
        id: attId,
        type,
        filename: att.filename,
        size: att.size,
        storage_ref: storagePath,
        mime_type: mimeType(att),
      });

      // Include images as vision blocks so Claude can process them
      if (type === "image") {
        const base64 = Buffer.from(buf).toString("base64");
        imageBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mimeType(att), data: base64 },
        });
      }
    } catch {
      // Skip attachment on error; message is still created
    }
  }

  // Insert SB-attachments records
  if (attachmentMeta.length > 0) {
    await supabase.from("SB-attachments").insert(
      attachmentMeta.map((a) => ({
        id: a.id,
        user_id: userId,
        created_at: now,
        updated_at: now,
        message_id: messageId,
        type: a.type,
        filename: a.filename,
        size: a.size,
        storage_ref: a.storage_ref,
        mime_type: a.mime_type,
      }))
    );
  }

  // Build content blocks: text + images + missive ref metadata
  const contentBlocks: unknown[] = [
    { type: "text", text: messageText },
    ...imageBlocks,
    // Non-rendered metadata block for deduplication / traceability
    {
      type: "missive_ref",
      missive_message_id: latest_message.id,
      missive_conversation_id: conversation.id,
    },
  ];

  // Insert the user message
  const { error: msgErr } = await supabase.from("SB-messages").insert({
    id: messageId,
    user_id: userId,
    created_at: now,
    updated_at: now,
    conversation_id: conversationId,
    role: "user",
    content: contentBlocks,
    timestamp: now,
    activated_skills: [],
    model_used: null,
    usage: null,
    previous_versions: [],
    attachments: attachmentMeta,
  });

  if (msgErr) {
    return Response.json({ error: msgErr.message }, { status: 500 });
  }

  return Response.json({ ok: true, conversationId, messageId });
}
