-- Seed script: inserts test data for development.
-- Run from the Supabase SQL editor (Dashboard → SQL Editor) as a project admin.
--
-- Prerequisites:
--   1. Run all migrations first (supabase db push, or apply via dashboard)
--   2. Sign in to the app at least once so your user row exists in auth.users
--   3. Replace TEST_USER_ID below with your actual user UUID
--      (find it via: SELECT id, email FROM auth.users LIMIT 5;)

DO $$
DECLARE
  v_user_id         uuid := 'REPLACE-WITH-YOUR-USER-UUID'::uuid;
  v_project_id      uuid;
  v_tag_urgent      uuid;
  v_tag_research    uuid;
  v_conv_id_1       uuid;
  v_conv_id_2       uuid;
  v_msg_id          uuid;
  v_skill_id        uuid;
BEGIN
  -- Guard: abort if placeholder UUID is still in place
  IF v_user_id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Replace TEST_USER_ID with your actual user UUID before running seed';
  END IF;

  -- ── user_settings ─────────────────────────────────────────────────────────
  INSERT INTO "SB-user_settings" (user_id, default_model, theme)
  VALUES (v_user_id, 'claude-opus-4-7', 'dark')
  ON CONFLICT (user_id) DO NOTHING;

  -- ── tags ──────────────────────────────────────────────────────────────────
  INSERT INTO "SB-tags" (user_id, name, color)
  VALUES (v_user_id, 'urgent', '#ef4444')
  ON CONFLICT (user_id, name) DO NOTHING
  RETURNING id INTO v_tag_urgent;

  IF v_tag_urgent IS NULL THEN
    SELECT id INTO v_tag_urgent FROM "SB-tags"
    WHERE user_id = v_user_id AND name = 'urgent';
  END IF;

  INSERT INTO "SB-tags" (user_id, name, color)
  VALUES (v_user_id, 'research', '#3b82f6')
  ON CONFLICT (user_id, name) DO NOTHING
  RETURNING id INTO v_tag_research;

  IF v_tag_research IS NULL THEN
    SELECT id INTO v_tag_research FROM "SB-tags"
    WHERE user_id = v_user_id AND name = 'research';
  END IF;

  -- ── project ───────────────────────────────────────────────────────────────
  INSERT INTO "SB-projects" (user_id, name, description, system_prompt, color)
  VALUES (
    v_user_id,
    'Test Project',
    'Seed data project for development',
    'You are a helpful assistant. Keep responses concise.',
    '#6366f1'
  )
  RETURNING id INTO v_project_id;

  -- ── conversations ─────────────────────────────────────────────────────────
  INSERT INTO "SB-conversations" (
    id, user_id, project_id, model, title, status, tags,
    total_input_tokens, total_output_tokens, total_cost_usd
  )
  VALUES (
    gen_random_uuid(), v_user_id, v_project_id,
    'claude-opus-4-7', 'Hello world conversation',
    'inbox', ARRAY[v_tag_urgent],
    150, 200, 0.002250
  )
  RETURNING id INTO v_conv_id_1;

  INSERT INTO "SB-conversations" (
    id, user_id, project_id, model, title, status, tags,
    pinned, pinned_at
  )
  VALUES (
    gen_random_uuid(), v_user_id, v_project_id,
    'claude-sonnet-4-6', 'Pinned research thread',
    'inbox', ARRAY[v_tag_research],
    true, now()
  )
  RETURNING id INTO v_conv_id_2;

  -- ── messages ──────────────────────────────────────────────────────────────
  INSERT INTO "SB-messages" (user_id, conversation_id, role, content, timestamp)
  VALUES (
    v_user_id, v_conv_id_1, 'user',
    '[{"type":"text","text":"Hello! Can you help me test this app?"}]'::jsonb,
    now() - interval '5 minutes'
  );

  INSERT INTO "SB-messages" (
    user_id, conversation_id, role, content, timestamp, model_used,
    usage
  )
  VALUES (
    v_user_id, v_conv_id_1, 'assistant',
    '[{"type":"text","text":"Of course! The app is working correctly. What would you like to test?"}]'::jsonb,
    now() - interval '4 minutes',
    'claude-opus-4-7',
    '{"input_tokens":150,"output_tokens":200,"cost_usd":0.002250}'::jsonb
  );

  -- ── skill ─────────────────────────────────────────────────────────────────
  INSERT INTO "SB-skills" (
    user_id, name, description, version, body, enabled, source
  )
  VALUES (
    v_user_id,
    'Summarizer',
    'Summarizes long documents into bullet points',
    '1.0.0',
    E'---\nname: Summarizer\ndescription: Summarizes long documents into bullet points\nversion: 1.0.0\nallowed_tools: []\n---\n\nWhen the user asks you to summarize something, output a concise bullet-point summary with the key points.',
    true,
    'paste'
  )
  RETURNING id INTO v_skill_id;

  -- ── template ──────────────────────────────────────────────────────────────
  INSERT INTO "SB-templates" (user_id, name, body, variables)
  VALUES (
    v_user_id,
    'Code review',
    'Please review the following {{language}} code and suggest improvements:\n\n```{{language}}\n{{code}}\n```',
    ARRAY['language', 'code']
  );

  RAISE NOTICE 'Seed complete. project_id=%, conv_id_1=%, skill_id=%',
    v_project_id, v_conv_id_1, v_skill_id;
END $$;
