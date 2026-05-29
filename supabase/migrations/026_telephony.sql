-- ============================================================
-- 026 — Call Center / Telephony Module
-- ============================================================
-- Adds:
--   1. profiles.phone              – agent's phone for click-to-call
--   2. telephony_providers         – active provider config (encrypted)
--   3. telephony_call_logs         – one row per call attempt
--   4. call metadata columns on followup tables (recording, duration)
-- ============================================================

-- ── 1. Agent phone on profiles ────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;


-- ── 2. telephony_providers ────────────────────────────────────
-- One active provider at a time. Config stored AES-256-GCM encrypted.

CREATE TABLE telephony_providers (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  provider_key         TEXT        NOT NULL UNIQUE
                       CHECK (provider_key IN ('tata_tele', 'deetyasoft')),
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  -- AES-256-GCM encrypted JSON blob (same utility as whatsapp_config)
  config               TEXT,
  webhook_identifier   TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE telephony_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telephony_providers_select" ON telephony_providers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "telephony_providers_modify" ON telephony_providers
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));


-- ── 3. telephony_call_logs ────────────────────────────────────

CREATE TABLE telephony_call_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_call_id TEXT,
  provider_id      UUID        REFERENCES telephony_providers(id) ON DELETE SET NULL,
  contact_id       UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id          UUID        REFERENCES deals(id) ON DELETE SET NULL,
  initiated_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  from_number      TEXT,
  to_number        TEXT,
  status           TEXT        NOT NULL DEFAULT 'initiated'
                   CHECK (status IN ('initiated','ringing','answered','completed',
                                     'no_answer','busy','failed','canceled')),
  duration         INTEGER,                -- seconds
  recording_url    TEXT,
  webhook_payload  JSONB,                  -- sanitized raw webhook payload
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_logs_contact     ON telephony_call_logs(contact_id);
CREATE INDEX idx_call_logs_deal        ON telephony_call_logs(deal_id);
CREATE INDEX idx_call_logs_provider_id ON telephony_call_logs(provider_call_id);
CREATE INDEX idx_call_logs_initiated   ON telephony_call_logs(initiated_by);

ALTER TABLE telephony_call_logs ENABLE ROW LEVEL SECURITY;

-- Admin/Owner/Manager see all logs
CREATE POLICY "call_logs_select_all" ON telephony_call_logs
  FOR SELECT USING (my_role() IN ('admin', 'owner', 'manager'));

-- Executive sees only calls they initiated
CREATE POLICY "call_logs_select_own" ON telephony_call_logs
  FOR SELECT USING (
    my_role() = 'executive'
    AND initiated_by = (
      SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Service-role (webhook) writes via admin client — no INSERT policy needed for RLS.


-- ── 4. Extend followup tables with call metadata ──────────────

ALTER TABLE contact_followups
  ADD COLUMN IF NOT EXISTS call_log_id   UUID    REFERENCES telephony_call_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS call_duration INTEGER;

ALTER TABLE deal_followups
  ADD COLUMN IF NOT EXISTS call_log_id   UUID    REFERENCES telephony_call_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS call_duration INTEGER;
