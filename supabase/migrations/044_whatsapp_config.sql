-- ============================================================
-- 044 — WhatsApp config (singleton coexistence onboarding)
-- ============================================================

ALTER TABLE IF EXISTS whatsapp_config RENAME TO whatsapp_config_legacy;

CREATE TABLE whatsapp_config (
  id                          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  status                      TEXT NOT NULL DEFAULT 'NOT_CONNECTED'
                              CHECK (status IN (
                                'NOT_CONNECTED',
                                'EMBEDDED_SIGNUP_IN_PROGRESS',
                                'EMBEDDED_SIGNUP_COMPLETED',
                                'ASSET_VERIFIED',
                                'PERMISSIONS_VERIFIED',
                                'COEXISTENCE_VERIFIED',
                                'WEBHOOK_VERIFIED',
                                'TEST_MESSAGE_SENT',
                                'READY',
                                'FAILED'
                              )),
  onboarding_step             TEXT NOT NULL DEFAULT 'NOT_CONNECTED'
                              CHECK (onboarding_step IN (
                                'NOT_CONNECTED',
                                'EMBEDDED_SIGNUP_IN_PROGRESS',
                                'EMBEDDED_SIGNUP_COMPLETED',
                                'ASSET_VERIFIED',
                                'PERMISSIONS_VERIFIED',
                                'COEXISTENCE_VERIFIED',
                                'WEBHOOK_VERIFIED',
                                'TEST_MESSAGE_SENT',
                                'READY',
                                'FAILED'
                              )),
  connection_type             TEXT CHECK (connection_type IN ('embedded_signup', 'manual')),

  business_id                 TEXT,
  waba_id                     TEXT,
  phone_number_id             TEXT,
  phone_number                TEXT,
  display_name                TEXT,
  verified_name               TEXT,
  quality_rating              TEXT,
  messaging_limit_tier        TEXT,

  access_token                TEXT,
  token_type                  TEXT,
  token_last_verified_at      TIMESTAMPTZ,

  permissions_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  permissions_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

  webhook_verified            BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_subscription_status TEXT,
  webhook_last_received_at    TIMESTAMPTZ,
  verify_token                TEXT,

  coexistence_enabled         BOOLEAN NOT NULL DEFAULT FALSE,

  onboarding_test_phone       TEXT,
  last_test_message_id        TEXT,
  last_inbound_message_at     TIMESTAMPTZ,
  last_outbound_message_at    TIMESTAMPTZ,

  failure_reason              TEXT,
  is_active                   BOOLEAN NOT NULL DEFAULT FALSE,

  created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_config_waba ON whatsapp_config (waba_id)
  WHERE waba_id IS NOT NULL;
CREATE INDEX idx_wa_config_phone ON whatsapp_config (phone_number_id)
  WHERE phone_number_id IS NOT NULL;
CREATE INDEX idx_wa_config_status ON whatsapp_config (status);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_config_select" ON whatsapp_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "wa_config_modify" ON whatsapp_config
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));

DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_config;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing legacy whatsapp_config row if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_config_legacy'
  ) THEN
    INSERT INTO whatsapp_config (
      id,
      status,
      onboarding_step,
      connection_type,
      waba_id,
      phone_number_id,
      access_token,
      verify_token,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      1,
      CASE
        WHEN wc.status = 'connected' THEN 'EMBEDDED_SIGNUP_COMPLETED'
        ELSE 'NOT_CONNECTED'
      END,
      CASE
        WHEN wc.status = 'connected' THEN 'EMBEDDED_SIGNUP_COMPLETED'
        ELSE 'NOT_CONNECTED'
      END,
      'manual',
      wc.waba_id,
      wc.phone_number_id,
      wc.access_token,
      wc.verify_token,
      wc.status = 'connected',
      wc.created_at,
      wc.updated_at
    FROM whatsapp_config_legacy wc
    ORDER BY wc.updated_at DESC NULLS LAST
    LIMIT 1
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE whatsapp_config_legacy CASCADE;
  END IF;
END $$;

INSERT INTO whatsapp_config (id) VALUES (1) ON CONFLICT DO NOTHING;
