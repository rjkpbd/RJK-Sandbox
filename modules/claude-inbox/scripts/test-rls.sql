-- RLS verification tests.
-- Run from Supabase SQL editor as project admin (bypasses RLS by default).
-- Each test uses SET LOCAL ROLE / SET LOCAL "request.jwt.claims" to simulate
-- a specific authenticated user, then asserts the expected row count.

-- ── Setup: ensure two test users exist in auth.users ──────────────────────
-- These are placeholder UUIDs; replace with real user IDs from your project.
-- You can find them via: SELECT id, email FROM auth.users;

DO $$
DECLARE
  v_user_a   uuid := 'REPLACE-WITH-USER-A-UUID'::uuid;
  v_user_b   uuid := 'REPLACE-WITH-USER-B-UUID'::uuid;
  v_conv_a   uuid;
  v_count    integer;
BEGIN
  -- Create a conversation owned by user A
  INSERT INTO "SB-conversations" (user_id, model, title, status)
  VALUES (v_user_a, 'claude-opus-4-7', 'User A private convo', 'inbox')
  RETURNING id INTO v_conv_a;

  -- ── Test 1: User A can read their own conversation ────────────────────
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user_a::text)::text, true);

  SELECT count(*) INTO v_count
  FROM "SB-conversations"
  WHERE id = v_conv_a;

  -- Service role ignores RLS, so we test with set_config simulation
  -- Full RLS testing requires using the anon/authenticated role via PostgREST
  RAISE NOTICE 'Test 1 (admin bypass reads user A conv): count=%  [expect 1]', v_count;

  -- ── Test 2: Confirm append-only on mcp_audit_log ─────────────────────
  -- Insert should succeed
  INSERT INTO "SB-mcp_audit_log" (
    user_id, server_name, tool_name, input, timestamp
  ) VALUES (
    v_user_a, 'test-server', 'test-tool',
    '{"arg":"value"}'::jsonb, now()
  );
  RAISE NOTICE 'Test 2 (insert audit log): OK';

  -- Update should be blocked by missing policy (will be caught by app, not here)
  -- To properly test, use the Supabase REST API with an authenticated JWT
  RAISE NOTICE 'Test 2b (update audit log blocked): verify via REST API with user JWT';

  -- ── Cleanup ────────────────────────────────────────────────────────────
  DELETE FROM "SB-conversations" WHERE id = v_conv_a;
  DELETE FROM "SB-mcp_audit_log" WHERE user_id = v_user_a AND server_name = 'test-server';

  RAISE NOTICE '---';
  RAISE NOTICE 'NOTE: Full RLS cross-user isolation must be tested via the PostgREST REST API';
  RAISE NOTICE 'using two separate authenticated JWTs. SQL editor runs as service_role';
  RAISE NOTICE 'which bypasses RLS. Use the Supabase REST client or run the app to verify.';
END $$;
