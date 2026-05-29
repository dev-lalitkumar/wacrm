-- ============================================================
-- 024 — Meta / Facebook Integration
-- ============================================================
-- Adds:
--   1. facebook_config        – singleton OAuth token storage
--   2. facebook_pages         – pages the admin has connected
--   3. facebook_lead_forms    – lead ad forms per page
--   4. facebook_field_mappings – form field → CRM field mapping
--   5. meta_webhook_logs      – audit log for leadgen webhook events
-- ============================================================

-- ── 1. facebook_config (singleton — same pattern as gmail_config) ──

CREATE TABLE facebook_config (
  id               INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Encrypted with AES-256-GCM via ENCRYPTION_KEY
  user_token       TEXT,
  fb_user_id       TEXT,
  fb_user_name     TEXT,
  fb_user_email    TEXT,
  token_expires_at BIGINT,
  status           TEXT NOT NULL DEFAULT 'disconnected'
                   CHECK (status IN ('connected', 'disconnected', 'error')),
  connected_at     TIMESTAMPTZ,
  connected_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO facebook_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE facebook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facebook_config_select" ON facebook_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "facebook_config_modify" ON facebook_config
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));


-- ── 2. facebook_pages ─────────────────────────────────────────────

CREATE TABLE facebook_pages (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  -- Encrypted page access token (non-expiring for subscribed pages)
  access_token   TEXT NOT NULL,
  category       TEXT,
  picture_url    TEXT,
  is_subscribed  BOOLEAN NOT NULL DEFAULT FALSE,
  subscribed_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE facebook_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facebook_pages_select" ON facebook_pages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "facebook_pages_modify" ON facebook_pages
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));


-- ── 3. facebook_lead_forms ────────────────────────────────────────

CREATE TABLE facebook_lead_forms (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  -- Array of { key, label, type } objects from Meta's form API
  questions  JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_forms_page ON facebook_lead_forms(page_id);

ALTER TABLE facebook_lead_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facebook_lead_forms_select" ON facebook_lead_forms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "facebook_lead_forms_modify" ON facebook_lead_forms
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));


-- ── 4. facebook_field_mappings ────────────────────────────────────
-- Maps a Facebook form field key → a CRM field.
-- crm_object: 'contact' | 'deal'
-- crm_field:  column name or 'custom_data.<key>'

CREATE TABLE facebook_field_mappings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      TEXT NOT NULL REFERENCES facebook_lead_forms(id) ON DELETE CASCADE,
  fb_field_key TEXT NOT NULL,
  crm_object   TEXT NOT NULL CHECK (crm_object IN ('contact', 'deal')),
  crm_field    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, fb_field_key)
);

CREATE INDEX idx_field_mappings_form ON facebook_field_mappings(form_id);

ALTER TABLE facebook_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facebook_field_mappings_select" ON facebook_field_mappings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "facebook_field_mappings_modify" ON facebook_field_mappings
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));


-- ── 5. meta_webhook_logs ──────────────────────────────────────────

CREATE TABLE meta_webhook_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leadgen_id    TEXT NOT NULL,
  page_id       TEXT,
  form_id       TEXT,
  status        TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id       UUID REFERENCES deals(id) ON DELETE SET NULL,
  error_message TEXT,
  raw_payload   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meta_logs_leadgen ON meta_webhook_logs(leadgen_id);
CREATE INDEX idx_meta_logs_page    ON meta_webhook_logs(page_id);
CREATE INDEX idx_meta_logs_status  ON meta_webhook_logs(status);

ALTER TABLE meta_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_webhook_logs_select" ON meta_webhook_logs
  FOR SELECT USING (my_role() IN ('admin', 'owner'));

-- Webhook inserts via service-role (admin client) — bypasses RLS.
