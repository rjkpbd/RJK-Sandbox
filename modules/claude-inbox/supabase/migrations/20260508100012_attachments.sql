-- Migration 012: attachments
-- File metadata for message attachments. Actual bytes live in the
-- Supabase Storage 'attachments' bucket at path {user_id}/{attachment_id}/{filename}.

CREATE TABLE IF NOT EXISTS "SB-attachments" (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL,

  message_id   uuid        REFERENCES "SB-messages"(id) ON DELETE CASCADE NOT NULL,

  -- 'image' | 'pdf' | 'text'
  type         text        NOT NULL,
  filename     text        NOT NULL,
  size         integer     NOT NULL,       -- bytes
  storage_ref  text        NOT NULL,       -- storage object path
  mime_type    text        NOT NULL
);

CREATE TRIGGER "SB-attachments_updated_at"
  BEFORE UPDATE ON "SB-attachments"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-attachments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-attachments: owner access"
  ON "SB-attachments"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
