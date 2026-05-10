-- Migration 002: devices
-- Tracks known devices for trusted-device escrow (6-digit code approval flow).

CREATE TABLE IF NOT EXISTS "SB-devices" (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,

  fingerprint    text        NOT NULL,
  name           text        NOT NULL,
  last_seen_at   timestamptz DEFAULT now() NOT NULL,
  trusted        boolean     DEFAULT false NOT NULL,

  UNIQUE (user_id, fingerprint)
);

CREATE TRIGGER "SB-devices_updated_at"
  BEFORE UPDATE ON "SB-devices"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "SB-devices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SB-devices: owner access"
  ON "SB-devices"
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
