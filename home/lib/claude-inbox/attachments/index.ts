"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = "attachments";
export const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB (matches bucket limit)

const ACCEPTED_TYPES: Record<string, AttachmentType> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/gif": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/markdown": "text",
  "text/csv": "text",
  "application/json": "text",
};

export type AttachmentType = "image" | "pdf" | "text";

export interface PendingAttachment {
  id: string;
  file: File;
  type: AttachmentType;
  /** Object URL for image previews — revoke when done */
  previewUrl?: string;
}

export interface PreparedAttachment {
  id: string;
  type: AttachmentType;
  filename: string;
  mimeType: string;
  base64: string;
  /** Supabase Storage path if upload succeeded */
  storageRef?: string;
}

export function classifyFile(file: File): AttachmentType | null {
  return (
    ACCEPTED_TYPES[file.type] ??
    (file.name.endsWith(".md") || file.name.endsWith(".txt") ? "text" : null)
  );
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_SIZE)
    return `${file.name} exceeds the 50 MB limit`;
  if (!classifyFile(file))
    return `${file.name}: unsupported type (images, PDF, and text files only)`;
  return null;
}

export function createPendingAttachment(file: File): PendingAttachment | null {
  const type = classifyFile(file);
  if (!type) return null;
  return {
    id: crypto.randomUUID(),
    file,
    type,
    previewUrl: type === "image" ? URL.createObjectURL(file) : undefined,
  };
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function prepareAttachment(
  pending: PendingAttachment
): Promise<PreparedAttachment> {
  const base64 = await readAsBase64(pending.file);

  // Best-effort upload to Supabase Storage
  let storageRef: string | undefined;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const path = `${user.id}/${pending.id}/${pending.file.name}`;
      const { data } = await supabase.storage
        .from(BUCKET)
        .upload(path, pending.file, { contentType: pending.file.type });
      if (data) storageRef = data.path;
    }
  } catch {
    // Proceed without storage ref
  }

  return {
    id: pending.id,
    type: pending.type,
    filename: pending.file.name,
    mimeType: pending.file.type,
    base64,
    storageRef,
  };
}

/** Build an Anthropic-compatible content array from text + attachments. */
export function buildMessageContent(
  text: string,
  attachments: PreparedAttachment[]
): string | AnthropicBlock[] {
  if (attachments.length === 0) return text;

  const blocks: AnthropicBlock[] = [];

  for (const att of attachments) {
    if (att.type === "image") {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mimeType,
          data: att.base64,
        },
      });
    } else if (att.type === "pdf") {
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: att.base64,
        },
      });
    } else {
      // text/csv/json — decode and include verbatim
      try {
        const bytes = Uint8Array.from(atob(att.base64), (c) => c.charCodeAt(0));
        const content = new TextDecoder().decode(bytes);
        blocks.push({
          type: "text",
          text: `<file name="${att.filename}">\n${content}\n</file>`,
        });
      } catch {
        blocks.push({ type: "text", text: `[Could not read ${att.filename}]` });
      }
    }
  }

  if (text.trim()) blocks.push({ type: "text", text });

  return blocks;
}

// Minimal Anthropic content block types (kept client-side, not importing SDK)
export type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };
