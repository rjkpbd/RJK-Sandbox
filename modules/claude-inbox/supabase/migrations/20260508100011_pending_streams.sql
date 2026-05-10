-- Migration 011: pending_streams
-- Tracks in-flight LLM streams for resilience (resume on reconnect).
-- One active record per in-progress generation. completed_at is set when done.

CREATE TABLE IF NOT EXISTS "SB-pending_streams" (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at                  timestamptz DEFAULT now() NOT NULL,
  updated_at                  timestamptz DEFAULT now() NOT NULL,

  conversation_id             uuid        REFERENCES "SB-conversations"(id) ON DELETE CASCADE NOT NULL,

  -- Full Anthropic messages request payload (minus the API key)
  request                     jsonb       NOT NULL,

  -- Accumulated assistant content blocks as they arrive
  partial_assistant_content   jsonb       DEFAULT '[]'::jsonb NOT NULL,

  started_at                  timestamptz DEFAULT now() NOT NULL,
  last_chunk_at               timestamptz DEFAULT now() NOT NULL,
  completed_at                timestamptz,              -- NULL = still in progress
  aborted_by_user             boolean     DEFAULT false NOT NULL,
  device_fingerprint          text        NOT NULL
);

CREATE TRIGGER "SB-pending_streams_updated_at"
  BEFORE UPDATE ON "SB-pending_streams"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-pending_streams" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-pending_streams: owner access"
  ON "SB-pending_streams"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
