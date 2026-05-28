-- ============================================================
-- 020 — Gmail Integration (plug-and-play email module)
-- ============================================================
-- Adds:
--   1. gmail_config    – org-level OAuth token storage (singleton)
--   2. email_logs      – sent email audit trail
--   3. email_notifications – inbound email cache for known contacts
-- ============================================================

-- ── 1. Gmail config (singleton — same pattern as whatsapp_config) ──

CREATE TABLE gmail_config (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expiry    TIMESTAMPTZ,
  connected_email TEXT,
  status          TEXT NOT NULL DEFAULT 'disconnected'
                  CHECK (status IN ('connected', 'disconnected', 'error')),
  scopes          TEXT[],
  connected_at    TIMESTAMPTZ,
  connected_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the singleton row so upserts always hit an existing row.
INSERT INTO gmail_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE gmail_config ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (UI checks status to show/hide features)
CREATE POLICY "gmail_config_read" ON gmail_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- Write: admin + owner only
CREATE POLICY "gmail_config_write" ON gmail_config
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));


-- ── 2. Email logs (sent email audit trail) ─────────────────────

CREATE TABLE email_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id  TEXT,
  gmail_thread_id   TEXT,
  from_email        TEXT NOT NULL,
  to_emails         TEXT[] NOT NULL,
  cc_emails         TEXT[],
  bcc_emails        TEXT[],
  subject           TEXT NOT NULL,
  body_text         TEXT,
  body_html         TEXT,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id           UUID REFERENCES deals(id) ON DELETE SET NULL,
  sent_by           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sending', 'sent', 'failed', 'bounced')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_logs_contact ON email_logs(contact_id);
CREATE INDEX idx_email_logs_deal    ON email_logs(deal_id);
CREATE INDEX idx_email_logs_thread  ON email_logs(gmail_thread_id);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_read" ON email_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "email_logs_insert" ON email_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ── 3. Email notifications (inbound email cache) ───────────────

CREATE TABLE email_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id  TEXT UNIQUE NOT NULL,
  gmail_thread_id   TEXT,
  from_email        TEXT NOT NULL,
  from_name         TEXT,
  subject           TEXT,
  snippet           TEXT,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  received_at       TIMESTAMPTZ NOT NULL,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_notif_contact ON email_notifications(contact_id);
CREATE INDEX idx_email_notif_unread  ON email_notifications(is_read) WHERE NOT is_read;

ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_notif_read" ON email_notifications
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "email_notif_write" ON email_notifications
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
