-- Migration 004: tags
-- User-defined labels for conversations.

CREATE TABLE IF NOT EXISTS "SB-tags" (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,

  name        text        NOT NULL,
  color       text        NOT NULL DEFAULT '#6366f1',

  UNIQUE (user_id, name)
);

CREATE TRIGGER "SB-tags_updated_at"
  BEFORE UPDATE ON "SB-tags"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-tags: owner access"
  ON "SB-tags"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
