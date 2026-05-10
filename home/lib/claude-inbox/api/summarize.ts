"use client";

import { getCachedApiKey } from "@/lib/claude-inbox/crypto/session";
import type { AnthropicMessage } from "./stream";

const COMPACT_SYSTEM =
  "You are summarizing a conversation so it can be compacted to free context space. " +
  "Write a thorough but concise summary that preserves all important information, " +
  "decisions, code snippets, and context. Use markdown headings if helpful. " +
  "The summary will replace the original messages as the new conversation history.";

export async function summarizeMessages(
  messages: AnthropicMessage[],
  model: string
): Promise<string> {
  const apiKey = getCachedApiKey();
  if (!apiKey) throw new Error("No API key in session. Unlock your vault first.");

  const payload = {
    apiKey,
    model,
    system: COMPACT_SYSTEM,
    maxTokens: 4096,
    messages: [
      ...messages,
      {
        role: "user" as const,
        content:
          "Summarize the entire conversation above into a compact but complete summary.",
      },
    ],
  };

  const res = await fetch("/api/claude-inbox/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let summary = "";
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
      if (raw === "[DONE]") return summary;
      try {
        const evt = JSON.parse(raw) as { type: string; text?: string };
        if (evt.type === "text" && evt.text) summary += evt.text;
      } catch {
        // ignore malformed lines
      }
    }
  }
  return summary;
}
