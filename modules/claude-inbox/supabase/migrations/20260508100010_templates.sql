-- Migration 010: templates
-- Reusable message templates with {{variable}} placeholders.
-- Inserted via slash-command picker; usage_count incremented on use.

CREATE TABLE IF NOT EXISTS "SB-templates" (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,

  name                text        NOT NULL,
  body                text        NOT NULL,
  variables           text[]      DEFAULT '{}'::text[] NOT NULL,
  default_project_id  uuid        REFERENCES "SB-projects"(id) ON DELETE SET NULL,
  default_model       text,
  default_skills      uuid[]      DEFAULT '{}'::uuid[] NOT NULL,
  usage_count         integer     DEFAULT 0 NOT NULL
);

CREATE TRIGGER "SB-templates_updated_at"
  BEFORE UPDATE ON "SB-templates"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-templates: owner access"
  ON "SB-templates"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
