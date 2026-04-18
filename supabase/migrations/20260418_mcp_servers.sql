-- MCP server registry
-- Stores connection details and credentials for each registered MCP server.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

CREATE TABLE IF NOT EXISTS mcp_servers (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL UNIQUE,        -- slug, e.g. "cin7-core"
  display_name  TEXT        NOT NULL,               -- "Cin7 Core"
  description   TEXT,
  server_type   TEXT        NOT NULL DEFAULT 'custom', -- "cin7" | "custom"
  url           TEXT,                               -- MCP endpoint (null = not deployed yet)
  bearer_token  TEXT,                               -- home app sends this to the MCP server
  credentials   JSONB       NOT NULL DEFAULT '{}',  -- upstream API credentials (e.g. Cin7 keys)
  enabled       BOOLEAN     NOT NULL DEFAULT true,
  last_health_check   TIMESTAMPTZ,
  last_health_status  TEXT,                         -- "healthy" | "unhealthy" | null
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the Cin7 Core entry so it shows up in the UI immediately
INSERT INTO mcp_servers (name, display_name, description, server_type, credentials)
VALUES (
  'cin7-core',
  'Cin7 Core',
  'Inventory, sales orders, purchase orders via Cin7 Core V2 API',
  'cin7',
  '{"cin7_account_id": "", "cin7_app_key": ""}'
)
ON CONFLICT (name) DO NOTHING;
