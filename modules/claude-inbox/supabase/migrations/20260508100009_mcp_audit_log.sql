-- Migration 009: mcp_audit_log
-- Append-only record of every MCP tool call. RLS blocks UPDATE and DELETE.
-- Retention enforced by a scheduled job in Step 20 using the service_role key.
-- No updated_at column — this table is never updated.

CREATE TABLE IF NOT EXISTS "SB-mcp_audit_log" (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at          timestamptz DEFAULT now() NOT NULL,

  conversation_id     uuid        REFERENCES "SB-conversations"(id) ON DELETE SET NULL,
  server_id           uuid        REFERENCES "SB-mcp_servers"(id)  ON DELETE SET NULL,
  server_name         text        NOT NULL,
  tool_name           text        NOT NULL,
  input               jsonb       NOT NULL,
  output              jsonb,      -- NULL if the call errored
  error               text,       -- NULL if successful
  device_fingerprint  text,
  model               text,
  timestamp           timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "SB-mcp_audit_log" ENABLE ROW LEVEL SECURITY;

-- Read access for the owner
CREATE POLICY "SB-mcp_audit_log: owner select"
  ON "SB-mcp_audit_log"
  FOR SELECT
  USING (user_id = auth.uid());

-- Insert access for the owner (required to log tool calls)
CREATE POLICY "SB-mcp_audit_log: owner insert"
  ON "SB-mcp_audit_log"
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE policy  → updates denied for all roles except service_role
-- No DELETE policy  → deletes denied for all roles except service_role
