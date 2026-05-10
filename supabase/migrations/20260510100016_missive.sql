-- Migration 016: missive integration
-- Adds missive_id and missive_messages_count to SB-conversations.
-- missive_id links a Claude Inbox conversation to a Missive conversation UUID.
-- missive_messages_count tracks the last-known Missive message count for change detection.

ALTER TABLE "SB-conversations"
  ADD COLUMN IF NOT EXISTS missive_id             text,
  ADD COLUMN IF NOT EXISTS missive_messages_count integer;

CREATE UNIQUE INDEX IF NOT EXISTS "idx-conversations-missive-id"
  ON "SB-conversations" (user_id, missive_id)
  WHERE missive_id IS NOT NULL;
