"use client";

import { getDB } from "@/lib/claude-inbox/sync/db";
import { updateProject } from "@/lib/claude-inbox/data/projects";

const COMPACT_THRESHOLD = 50_000; // chars

const COMPACT_SYSTEM =
  "You are compacting accumulated project context notes into a concise knowledge base. " +
  "Preserve all important decisions, facts, recurring topics, and useful context. " +
  "Remove redundant or outdated entries. Use markdown headings to organize the output. " +
  "The output replaces the previous context, so be thorough yet concise.";

async function compactProjectContext(context: string, apiKey: string, model: string): Promise<string> {
  const payload = {
    apiKey,
    model,
    system: COMPACT_SYSTEM,
    maxTokens: 4096,
    messages: [
      { role: "user" as const, content: `Compact the following project context:\n\n${context}` },
    ],
  };

  const res = await fetch("/api/claude-inbox/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Compact API error ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6);
      if (raw === "[DONE]") return result;
      try {
        const evt = JSON.parse(raw) as { type: string; text?: string };
        if (evt.type === "text" && evt.text) result += evt.text;
      } catch { /* skip */ }
    }
  }
  return result;
}

export async function appendConversationSummary(
  projectId: string,
  conversationId: string,
  apiKey: string,
  model: string
): Promise<void> {
  const db = getDB();
  const project = await db.projects.get(projectId);
  if (!project) return;

  const conversation = await db.conversations.get(conversationId);
  if (!conversation) return;

  const messages = await db.messages
    .where("conversation_id")
    .equals(conversationId)
    .toArray();
  messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Find the last user + assistant pair
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastAssistant || !lastUser) return;

  const extractText = (m: typeof messages[0]) => {
    const block = m.content.find((b) => (b as { type: string }).type === "text") as
      | { type: "text"; text: string }
      | undefined;
    return block?.text ?? "";
  };

  const userText = extractText(lastUser).slice(0, 300);
  const assistantText = extractText(lastAssistant).slice(0, 600);
  const title = conversation.title ?? userText.slice(0, 60).replace(/\n/g, " ");
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const entry = `### ${title} (${date})\n\n**User:** ${userText}\n\n**Assistant:** ${assistantText}`;

  const existing = project.project_context ?? "";
  let newContext = existing ? `${existing}\n\n---\n\n${entry}` : entry;

  if (newContext.length > COMPACT_THRESHOLD) {
    try {
      newContext = await compactProjectContext(newContext, apiKey, model);
    } catch {
      // Compaction failed — still save the raw appended version, trimmed to threshold
      newContext = newContext.slice(-COMPACT_THRESHOLD);
    }
  }

  await updateProject(projectId, { project_context: newContext });
}
