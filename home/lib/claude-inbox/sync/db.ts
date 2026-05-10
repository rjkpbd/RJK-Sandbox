import Dexie, { type Table } from "dexie";
import type {
  UserSettings,
  Device,
  Project,
  Conversation,
  Message,
  Tag,
  Skill,
  McpServer,
  Template,
  PendingStream,
  Attachment,
  OutboxItem,
  MetaEntry,
} from "./types";

export interface McpAuditEntry {
  id?: number;
  user_id: string;
  server_id: string;
  server_name: string;
  tool_name: string;
  input_summary: string;
  timestamp: string;
  result: "approved" | "denied" | "error";
}

export class ClaudeInboxDB extends Dexie {
  user_settings!: Table<UserSettings, string>;
  mcp_audit_log!: Table<McpAuditEntry, number>;
  devices!: Table<Device, string>;
  projects!: Table<Project, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  tags!: Table<Tag, string>;
  skills!: Table<Skill, string>;
  mcp_servers!: Table<McpServer, string>;
  templates!: Table<Template, string>;
  pending_streams!: Table<PendingStream, string>;
  attachments!: Table<Attachment, string>;
  _outbox!: Table<OutboxItem, number>;
  _meta!: Table<MetaEntry, string>;

  constructor() {
    super("claude-inbox");

    this.version(1).stores({
      user_settings: "id, user_id",
      devices: "id, user_id, fingerprint",
      projects: "id, user_id, name",
      conversations:
        "id, user_id, project_id, status, pinned, pinned_at, updated_at, snoozed_until",
      messages: "id, user_id, conversation_id, timestamp",
      tags: "id, user_id, name",
      skills: "id, user_id, name, enabled",
      mcp_servers: "id, user_id, name, enabled",
      templates: "id, user_id, name",
      pending_streams: "id, user_id, conversation_id, device_fingerprint",
      attachments: "id, user_id, message_id",
      _outbox: "++id, table, record_id, queued_at",
      _meta: "key",
    });

    this.version(2).stores({
      mcp_audit_log: "++id, user_id, server_id, timestamp",
    });

    this.version(3).stores({
      conversations:
        "id, user_id, project_id, status, pinned, pinned_at, updated_at, snoozed_until, missive_id",
    });
  }
}

let _db: ClaudeInboxDB | null = null;

export function getDB(): ClaudeInboxDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie (IndexedDB) is not available on the server");
  }
  if (!_db) {
    _db = new ClaudeInboxDB();
  }
  return _db;
}
