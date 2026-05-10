-- Migration 008: mcp_servers
-- Connected MCP servers. Tokens stored as client-side AES-GCM ciphertext.
-- tools_cache is refreshed on connect; tool_approval_modes is per-tool config.

CREATE TYPE mcp_transport AS ENUM ('sse', 'http');
CREATE TYPE mcp_auth_type  AS ENUM ('bearer', 'oauth');

CREATE TABLE IF NOT EXISTS "SB-mcp_servers" (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at            timestamptz   DEFAULT now() NOT NULL,
  updated_at            timestamptz   DEFAULT now() NOT NULL,

  name                  text          NOT NULL,
  url                   text          NOT NULL,
  transport             mcp_transport DEFAULT 'sse' NOT NULL,
  auth_type             mcp_auth_type DEFAULT 'bearer' NOT NULL,

  -- Encrypted with passphrase-derived key (AES-GCM, client-side)
  encrypted_token         text,
  encrypted_refresh_token text,
  oauth_metadata          jsonb,       -- discovery doc, client_id, scopes, etc.

  enabled               boolean       DEFAULT true NOT NULL,

  -- Cached from last successful connect
  -- Each entry: { name, description, inputSchema, destructive? }
  tools_cache           jsonb         DEFAULT '[]'::jsonb NOT NULL,

  -- { [toolName]: 'always'|'ask_each'|'ask_once'|'never' }
  tool_approval_modes   jsonb         DEFAULT '{}'::jsonb NOT NULL,

  last_connected_at     timestamptz,
  status                text          DEFAULT 'disconnected' NOT NULL
);

CREATE TRIGGER "SB-mcp_servers_updated_at"
  BEFORE UPDATE ON "SB-mcp_servers"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-mcp_servers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-mcp_servers: owner access"
  ON "SB-mcp_servers"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
