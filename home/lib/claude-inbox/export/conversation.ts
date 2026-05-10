"use client";

import { getDB } from "@/lib/claude-inbox/sync/db";
import { loadMessages, messageTextContent } from "@/lib/claude-inbox/data/messages";
import type { Conversation, Message } from "@/lib/claude-inbox/sync/types";

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFilename(title: string | null, ext: string): string {
  const base = (title ?? "conversation")
    .replace(/[^a-z0-9\-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "conversation";
  return `${base}.${ext}`;
}

export async function exportConversationMd(conversation: Conversation): Promise<void> {
  const messages = await loadMessages(conversation.id);
  const lines: string[] = [];
  lines.push(`# ${conversation.title ?? "Conversation"}`);
  lines.push(`\n_Model: ${conversation.model} · Created: ${new Date(conversation.created_at).toLocaleDateString()}_\n`);
  for (const msg of messages) {
    const role = msg.role === "user" ? "**You**" : "**Claude**";
    lines.push(`---\n\n${role}\n\n${messageTextContent(msg)}\n`);
  }
  triggerDownload(safeFilename(conversation.title, "md"), lines.join("\n"), "text/markdown");
}

export async function exportConversationJson(conversation: Conversation): Promise<void> {
  const messages = await loadMessages(conversation.id);
  const data = { conversation, messages, exported_at: new Date().toISOString() };
  triggerDownload(
    safeFilename(conversation.title, "json"),
    JSON.stringify(data, null, 2),
    "application/json"
  );
}

function buildPrintHtml(conversation: Conversation, messages: Message[]): string {
  const title = conversation.title ?? "Conversation";
  const date = new Date(conversation.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const msgHtml = messages
    .map((m) => {
      const role = m.role === "user" ? "You" : "Claude";
      const cls = m.role === "user" ? "user" : "assistant";
      const text = messageTextContent(m)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div class="message ${cls}"><div class="role">${role}</div><div class="content">${text}</div></div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body{font-family:Georgia,serif;max-width:700px;margin:2rem auto;color:#1a1a1a;line-height:1.6}
    h1{font-size:1.4rem;margin-bottom:.25rem}
    .meta{color:#666;font-size:.8rem;margin-bottom:2rem}
    .message{margin:1.5rem 0;padding-bottom:1.5rem;border-bottom:1px solid #e5e7eb}
    .message:last-child{border-bottom:none}
    .role{font-weight:700;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}
    .user .role{color:#4f46e5}
    .assistant .role{color:#059669}
    .content{white-space:pre-wrap;font-size:.9rem}
    @media print{body{margin:0;max-width:100%}}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Model: ${conversation.model} &middot; Created: ${date} &middot; Total cost: $${conversation.total_cost_usd.toFixed(4)}</p>
  ${msgHtml}
</body>
</html>`;
}

export async function openConversationPdfWindow(conversation: Conversation): Promise<void> {
  const messages = await loadMessages(conversation.id);
  const html = buildPrintHtml(conversation, messages);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Allow pop-ups to export as PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export async function exportFullAccount(userId: string): Promise<void> {
  const db = getDB();
  const [conversations, messages, settings, skills, templates] = await Promise.all([
    db.conversations.where("user_id").equals(userId).toArray(),
    db.messages.where("user_id").equals(userId).toArray(),
    db.user_settings.where("user_id").equals(userId).first(),
    db.skills.where("user_id").equals(userId).toArray(),
    db.templates.where("user_id").equals(userId).toArray(),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    settings: settings ?? null,
    conversations,
    messages,
    skills,
    templates,
  };

  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(`claude-inbox-export-${date}.json`, JSON.stringify(data, null, 2), "application/json");
}
