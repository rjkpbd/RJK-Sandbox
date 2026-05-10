-- RLS policy reference (canonical copies are in migrations/; this is documentation)
-- Pattern: every table restricts all operations to the row owner via user_id = auth.uid()
-- Exception: SB-mcp_audit_log is append-only (SELECT + INSERT only; no UPDATE/DELETE)

-- ── Standard owner-access tables ───────────────────────────────────────────
-- Applies to: SB-user_settings, SB-devices, SB-projects, SB-tags,
--             SB-conversations, SB-messages, SB-skills, SB-mcp_servers,
--             SB-templates, SB-pending_streams, SB-attachments

-- ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "<table>: owner access"
--   ON "<table>"
--   USING (user_id = auth.uid())
--   WITH CHECK (user_id = auth.uid());

-- ── Append-only: SB-mcp_audit_log ──────────────────────────────────────────
-- ALTER TABLE "SB-mcp_audit_log" ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "SB-mcp_audit_log: owner select"
--   ON "SB-mcp_audit_log" FOR SELECT
--   USING (user_id = auth.uid());
--
-- CREATE POLICY "SB-mcp_audit_log: owner insert"
--   ON "SB-mcp_audit_log" FOR INSERT
--   WITH CHECK (user_id = auth.uid());
--
-- (No UPDATE or DELETE policies — those operations are blocked for all except service_role)
-- (Retention cleanup in Step 20 uses the service_role key which bypasses RLS)

-- ── Storage policies ────────────────────────────────────────────────────────
-- Buckets: 'attachments', 'skill-files'
-- Objects stored at path: {user_id}/{record_id}/{filename}
-- Policy: split_part(name, '/', 1) = auth.uid()::text
-- (SELECT, INSERT, UPDATE, DELETE each have their own policy per bucket)
