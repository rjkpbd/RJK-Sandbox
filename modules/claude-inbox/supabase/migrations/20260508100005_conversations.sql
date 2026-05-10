-- Migration 005: conversations
-- Core conversation record. tags/skills/mcp references are uuid arrays
-- (denormalised for query simplicity; no FK constraints by design).

CREATE TYPE conversation_status AS ENUM ('inbox', 'archived', 'snoozed');

CREATE TABLE IF NOT EXISTS "SB-conversations" (
  id                    uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid                 REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at            timestamptz          DEFAULT now() NOT NULL,
  updated_at            timestamptz          DEFAULT now() NOT NULL,

  -- Grouping & identity
  project_id            uuid                 REFERENCES "SB-projects"(id) ON DELETE SET NULL,
  provider              text                 DEFAULT 'anthropic' NOT NULL,
  model                 text                 NOT NULL,
  title                 text,

  -- Prompts
  system_prompt         text,               -- conversation-level override (layer 3)

  -- Triage
  tags                  uuid[]               DEFAULT '{}'::uuid[] NOT NULL,
  status                conversation_status  DEFAULT 'inbox' NOT NULL,
  snoozed_until         timestamptz,

  -- Pinning
  pinned                boolean              DEFAULT false NOT NULL,
  pinned_at             timestamptz,

  -- Per-conversation skill/MCP overrides
  pinned_skills         uuid[]               DEFAULT '{}'::uuid[] NOT NULL,
  excluded_skills       uuid[]               DEFAULT '{}'::uuid[] NOT NULL,
  pinned_mcp_servers    uuid[]               DEFAULT '{}'::uuid[] NOT NULL,
  excluded_mcp_servers  uuid[]               DEFAULT '{}'::uuid[] NOT NULL,

  -- Accumulated token/cost totals (updated after each assistant turn)
  total_input_tokens    integer              DEFAULT 0 NOT NULL,
  total_output_tokens   integer              DEFAULT 0 NOT NULL,
  total_cost_usd        numeric(12,6)        DEFAULT 0 NOT NULL,
  context_tokens_used   integer              DEFAULT 0 NOT NULL,

  -- Fork lineage
  forked_from           uuid                 REFERENCES "SB-conversations"(id) ON DELETE SET NULL
);

CREATE TRIGGER "SB-conversations_updated_at"
  BEFORE UPDATE ON "SB-conversations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-conversations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-conversations: owner access"
  ON "SB-conversations"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
