-- Migration 007: skills
-- User-installed SKILL.md bundles. Body is the markdown content.
-- version_history stores last 10 versions as jsonb array.

CREATE TYPE skill_source AS ENUM ('upload', 'paste', 'github');

CREATE TABLE IF NOT EXISTS "SB-skills" (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid         REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at       timestamptz  DEFAULT now() NOT NULL,
  updated_at       timestamptz  DEFAULT now() NOT NULL,

  name             text         NOT NULL,
  description      text,
  version          text         NOT NULL,        -- semver (e.g. "1.0.0")
  body             text         NOT NULL,        -- SKILL.md body (markdown)
  allowed_tools    text[]       DEFAULT '{}'::text[] NOT NULL,
  files            jsonb        DEFAULT '[]'::jsonb NOT NULL,  -- [{ path, storage_ref }]
  enabled          boolean      DEFAULT true NOT NULL,
  source           skill_source DEFAULT 'paste' NOT NULL,
  source_url       text,                          -- GitHub raw URL if source='github'
  version_history  jsonb        DEFAULT '[]'::jsonb NOT NULL   -- last 10 versions
);

CREATE TRIGGER "SB-skills_updated_at"
  BEFORE UPDATE ON "SB-skills"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-skills" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-skills: owner access"
  ON "SB-skills"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
