// Entity interfaces matching the SB-* Supabase tables.
// Timestamps are ISO strings (Supabase REST API format). UUIDs are plain strings.

export interface UserSettings {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  default_model: string;
  theme: string;
  encrypted_api_key: string | null;
  kdf_salt: string | null;
  kdf_iterations: number;
  recovery_key_wrap: string | null;
  custom_instructions: string | null;
  daily_cost_cap_usd: number | null;
  monthly_cost_cap_usd: number | null;
  per_conversation_cap_usd: number | null;
  auto_archive_days: number | null;
  web_search_enabled: boolean;
  web_search_max_per_turn: number;
  allowed_domains: string[];
  blocked_domains: string[];
  mcp_audit_retention_days: number;
}

export interface Device {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  fingerprint: string;
  name: string;
  last_seen_at: string;
  trusted: boolean;
}

export interface Project {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  default_model: string | null;
  preferred_skills: string[];
  preferred_mcp_servers: string[];
  color: string | null;
}

export type ConversationStatus = "inbox" | "archived" | "snoozed";

export interface Conversation {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  provider: string;
  model: string;
  title: string | null;
  system_prompt: string | null;
  tags: string[];
  status: ConversationStatus;
  snoozed_until: string | null;
  pinned: boolean;
  pinned_at: string | null;
  pinned_skills: string[];
  excluded_skills: string[];
  pinned_mcp_servers: string[];
  excluded_mcp_servers: string[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  context_tokens_used: number;
  forked_from: string | null;
}

export type MessageRole = "user" | "assistant" | "system";

export interface TextBlock {
  type: "text";
  text: string;
}
export interface ImageBlock {
  type: "image";
  source: {
    type: "base64" | "url";
    media_type?: string;
    data?: string;
    url?: string;
  };
}
export type ContentBlock = TextBlock | ImageBlock | Record<string, unknown>;

export interface MessageUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface AttachmentMeta {
  id: string;
  type: "image" | "pdf" | "text";
  filename: string;
  size: number;
  storage_ref: string;
  mime_type: string;
}

export interface Message {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  conversation_id: string;
  role: MessageRole;
  content: ContentBlock[];
  timestamp: string;
  activated_skills: string[];
  model_used: string | null;
  usage: MessageUsage | null;
  previous_versions: Message[];
  attachments: AttachmentMeta[];
}

export interface Tag {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  color: string;
}

export type SkillSource = "upload" | "paste" | "github";

export interface SkillFile {
  path: string;
  storage_ref: string;
}

export interface Skill {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  version: string;
  body: string;
  allowed_tools: string[];
  files: SkillFile[];
  enabled: boolean;
  source: SkillSource;
  source_url: string | null;
  version_history: unknown[];
}

export type McpTransport = "sse" | "http";
export type McpAuthType = "bearer" | "oauth";
export type ToolApprovalMode = "always" | "ask_each" | "ask_once" | "never";

export interface McpToolCache {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  destructive?: boolean;
}

export interface McpServer {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  url: string;
  transport: McpTransport;
  auth_type: McpAuthType;
  encrypted_token: string | null;
  encrypted_refresh_token: string | null;
  oauth_metadata: Record<string, unknown> | null;
  enabled: boolean;
  tools_cache: McpToolCache[];
  tool_approval_modes: Record<string, ToolApprovalMode>;
  last_connected_at: string | null;
  status: string;
}

export interface Template {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  body: string;
  variables: string[];
  default_project_id: string | null;
  default_model: string | null;
  default_skills: string[];
  usage_count: number;
}

export interface PendingStream {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  conversation_id: string;
  request: Record<string, unknown>;
  partial_assistant_content: ContentBlock[];
  started_at: string;
  last_chunk_at: string;
  completed_at: string | null;
  aborted_by_user: boolean;
  device_fingerprint: string;
}

export interface Attachment {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  message_id: string;
  type: "image" | "pdf" | "text";
  filename: string;
  size: number;
  storage_ref: string;
  mime_type: string;
}

// ── Dexie-only types ─────────────────────────────────────────────────────────

export type OutboxOperation = "upsert" | "delete";

export interface OutboxItem {
  id?: number; // auto-incremented by Dexie
  table: string;
  operation: OutboxOperation;
  record_id: string;
  payload: unknown;
  queued_at: string;
  retry_count: number;
  last_error?: string;
}

export interface MetaEntry {
  key: string;
  value: string;
}
