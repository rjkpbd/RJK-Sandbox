-- Migration 001: user_settings
-- Stores per-user preferences, encrypted API key, KDF params, and cost caps.

-- Reusable trigger function — all other tables reference this
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS "SB-user_settings" (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  created_at                  timestamptz DEFAULT now() NOT NULL,
  updated_at                  timestamptz DEFAULT now() NOT NULL,

  -- Model & UI
  default_model               text        DEFAULT 'claude-opus-4-7' NOT NULL,
  theme                       text        DEFAULT 'dark' NOT NULL,

  -- Client-side encrypted API key (passphrase-derived AES-GCM; plaintext never leaves browser)
  encrypted_api_key           text,
  kdf_salt                    text,
  kdf_iterations              integer     DEFAULT 600000 NOT NULL,
  recovery_key_wrap           text,       -- DEK wrapped by key derived from BIP39 recovery phrase

  -- Custom instructions (global layer)
  custom_instructions         text,

  -- Cost caps (USD; NULL = no cap)
  daily_cost_cap_usd          numeric(10,4),
  monthly_cost_cap_usd        numeric(10,4),
  per_conversation_cap_usd    numeric(10,4),

  -- Auto-archive (NULL = disabled)
  auto_archive_days           integer,

  -- Web search
  web_search_enabled          boolean     DEFAULT false NOT NULL,
  web_search_max_per_turn     integer     DEFAULT 3 NOT NULL,
  allowed_domains             text[]      DEFAULT '{}'::text[] NOT NULL,
  blocked_domains             text[]      DEFAULT '{}'::text[] NOT NULL,

  -- MCP audit log retention (days; default 90)
  mcp_audit_retention_days    integer     DEFAULT 90 NOT NULL
);

CREATE TRIGGER "SB-user_settings_updated_at"
  BEFORE UPDATE ON "SB-user_settings"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-user_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-user_settings: owner access"
  ON "SB-user_settings"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
