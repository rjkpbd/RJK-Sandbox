-- Migration 006: messages
-- Individual turns within a conversation. Append-mostly (edits create new rows
-- and store old content in previous_versions). Keyed by client UUID to dedupe
-- during offline sync.

CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE IF NOT EXISTS "SB-messages" (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid         REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at          timestamptz  DEFAULT now() NOT NULL,
  updated_at          timestamptz  DEFAULT now() NOT NULL,

  conversation_id     uuid         REFERENCES "SB-conversations"(id) ON DELETE CASCADE NOT NULL,
  role                message_role NOT NULL,

  -- ContentBlock[] — matches Anthropic's content block schema
  -- Each block: { type: 'text'|'image'|'tool_use'|'tool_result', ... }
  content             jsonb        NOT NULL DEFAULT '[]'::jsonb,

  timestamp           timestamptz  DEFAULT now() NOT NULL,

  -- Skills that were injected for this turn
  activated_skills    uuid[]       DEFAULT '{}'::uuid[] NOT NULL,

  -- Only set on assistant messages
  model_used          text,
  usage               jsonb,        -- { input_tokens, output_tokens, cost_usd }

  -- Previous content versions (for edit-and-resend)
  previous_versions   jsonb        DEFAULT '[]'::jsonb NOT NULL,

  -- Inline attachment metadata (full file in SB-attachments + storage)
  attachments         jsonb        DEFAULT '[]'::jsonb NOT NULL
);

CREATE TRIGGER "SB-messages_updated_at"
  BEFORE UPDATE ON "SB-messages"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-messages: owner access"
  ON "SB-messages"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
