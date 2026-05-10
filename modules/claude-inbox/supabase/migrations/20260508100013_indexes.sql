-- Migration 013: indexes
-- Performance indexes for the primary query patterns.

-- Conversation list view (inbox/archived/snoozed sorted by recency)
CREATE INDEX IF NOT EXISTS "idx-conversations-user-status-updated"
  ON "SB-conversations" (user_id, status, updated_at DESC);

-- Project-scoped conversation list
CREATE INDEX IF NOT EXISTS "idx-conversations-user-project-status"
  ON "SB-conversations" (user_id, project_id, status);

-- Pinned conversations (partial index — only pinned rows)
CREATE INDEX IF NOT EXISTS "idx-conversations-user-pinned"
  ON "SB-conversations" (user_id, pinned_at DESC)
  WHERE pinned = true;

-- Snoozed conversations due for waking (Step 20 job)
CREATE INDEX IF NOT EXISTS "idx-conversations-snoozed-until"
  ON "SB-conversations" (user_id, snoozed_until)
  WHERE status = 'snoozed' AND snoozed_until IS NOT NULL;

-- Thread loading (chronological message order)
CREATE INDEX IF NOT EXISTS "idx-messages-conversation-timestamp"
  ON "SB-messages" (conversation_id, timestamp);

-- Audit log scrolling (reverse-chronological per user)
CREATE INDEX IF NOT EXISTS "idx-mcp-audit-log-user-timestamp"
  ON "SB-mcp_audit_log" (user_id, timestamp DESC);

-- Device lookup by fingerprint
CREATE INDEX IF NOT EXISTS "idx-devices-user-fingerprint"
  ON "SB-devices" (user_id, fingerprint);

-- Incomplete pending streams (for resume-on-reconnect check)
CREATE INDEX IF NOT EXISTS "idx-pending-streams-conversation-incomplete"
  ON "SB-pending_streams" (conversation_id)
  WHERE completed_at IS NULL AND aborted_by_user = false;

-- Attachment lookup by message
CREATE INDEX IF NOT EXISTS "idx-attachments-message"
  ON "SB-attachments" (message_id);
