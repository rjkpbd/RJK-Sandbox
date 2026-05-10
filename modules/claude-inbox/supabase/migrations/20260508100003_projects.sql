-- Migration 003: projects
-- Groups conversations with a shared system prompt and default settings.

CREATE TABLE IF NOT EXISTS "SB-projects" (
  id                   uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid     REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at           timestamptz DEFAULT now() NOT NULL,
  updated_at           timestamptz DEFAULT now() NOT NULL,

  name                 text     NOT NULL,
  description          text,
  system_prompt        text,
  default_model        text,
  preferred_skills     uuid[]   DEFAULT '{}'::uuid[] NOT NULL,
  preferred_mcp_servers uuid[]  DEFAULT '{}'::uuid[] NOT NULL,
  color                text
);

CREATE TRIGGER "SB-projects_updated_at"
  BEFORE UPDATE ON "SB-projects"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-projects: owner access"
  ON "SB-projects"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
