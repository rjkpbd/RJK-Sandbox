-- Migration 014: realtime
-- Enable Supabase Realtime (Postgres changes) on tables that require live sync.
-- Prerequisite: supabase_realtime publication must exist (created by Supabase automatically).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE "SB-conversations";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-messages";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-tags";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-projects";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-skills";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-mcp_servers";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-templates";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-user_settings";
ALTER PUBLICATION supabase_realtime ADD TABLE "SB-pending_streams";
