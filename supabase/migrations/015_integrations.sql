-- ============================================================
-- 015_integrations.sql
--
-- Adds:
--   • sources master table (with two seeded system rows: Direct, WhatsApp)
--   • source_id column on contacts + deals (backfilled to Direct)
--   • round_robin_config singleton table (global assignment pool)
--   • webhooks table (admin-managed lead-ingestion endpoints)
--   • webhook_requests audit/rate-limit log
--   • pick_next_assignee() SECURITY DEFINER rotation function
--   • protect_system_sources() trigger
--   • RLS: sources/round_robin_config readable by all signed in, written by admin;
--          webhooks readable by admin/owner/manager, written by admin;
--          webhook_requests readable by admin/owner/manager, service-role-only inserts
-- ============================================================

-- ============================================================
-- 1. Sources master
-- ============================================================
CREATE TABLE IF NOT EXISTS sources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  key         TEXT NOT NULL UNIQUE,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed system sources (idempotent)
INSERT INTO sources (name, key, is_system, sort_order) VALUES
  ('Direct',   'direct',   TRUE, 0),
  ('WhatsApp', 'whatsapp', TRUE, 1)
ON CONFLICT (key) DO NOTHING;

-- Protect system rows from delete + key/is_system mutation
CREATE OR REPLACE FUNCTION public.protect_system_sources()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_system THEN
    RAISE EXCEPTION 'System sources cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_system
     AND (NEW.key <> OLD.key OR NEW.is_system <> OLD.is_system) THEN
    RAISE EXCEPTION 'System source key and is_system flag are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_system_sources ON sources;
CREATE TRIGGER trg_protect_system_sources
  BEFORE UPDATE OR DELETE ON sources
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_sources();

-- ============================================================
-- 2. source_id on contacts + deals (backfill to Direct)
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

UPDATE contacts
   SET source_id = (SELECT id FROM sources WHERE key = 'direct')
 WHERE source_id IS NULL;

UPDATE deals
   SET source_id = (SELECT id FROM sources WHERE key = 'direct')
 WHERE source_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts (source_id);
CREATE INDEX IF NOT EXISTS idx_deals_source    ON deals    (source_id);

-- ============================================================
-- 3. Global round-robin config (singleton row id=1)
-- ============================================================
CREATE TABLE IF NOT EXISTS round_robin_config (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  member_ids  UUID[] NOT NULL DEFAULT '{}',
  last_index  INTEGER NOT NULL DEFAULT -1,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO round_robin_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Webhooks
-- ============================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     TEXT NOT NULL,
  source_id                UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  secret_encrypted         TEXT NOT NULL,
  secret_prefix            TEXT NOT NULL,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,

  creates_deal             BOOLEAN NOT NULL DEFAULT FALSE,
  pipeline_id              UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  stage_id                 UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,

  -- Shape:
  -- { "contact": { "name": "$.first_name", "phone": "$.mobile", "cf:<uuid>": "$.utm_source" },
  --   "deal":    { "title": "$.form_name", "value": "$.amount", "cf:<uuid>": "$.lead_score" } }
  field_mappings           JSONB NOT NULL DEFAULT '{}'::jsonb,

  round_robin_override     BOOLEAN NOT NULL DEFAULT FALSE,
  round_robin_member_ids   UUID[] NOT NULL DEFAULT '{}',
  round_robin_last_index   INTEGER NOT NULL DEFAULT -1,

  rate_limit_per_minute    INTEGER NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute > 0),

  created_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks (is_active);

-- ============================================================
-- 5. Webhook request log
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id          UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address          TEXT,
  status              TEXT NOT NULL CHECK (status IN ('ok','rate_limited','invalid_secret','bad_payload','disabled','error')),
  error_message       TEXT,
  payload_preview     TEXT,
  created_contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_requests_recent
  ON webhook_requests (webhook_id, received_at DESC);

-- ============================================================
-- 6. pick_next_assignee() — atomic rotation
--    Priority: per-webhook override → global pool → NULL.
-- ============================================================
CREATE OR REPLACE FUNCTION public.pick_next_assignee(p_webhook_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override BOOLEAN;
  v_members  UUID[];
  v_idx      INTEGER;
  v_enabled  BOOLEAN;
  v_next     INTEGER;
BEGIN
  -- Per-webhook override path
  SELECT round_robin_override, round_robin_member_ids, round_robin_last_index
    INTO v_override, v_members, v_idx
    FROM webhooks
   WHERE id = p_webhook_id
     FOR UPDATE;

  IF v_override AND cardinality(v_members) > 0 THEN
    v_next := (v_idx + 1) % cardinality(v_members);
    UPDATE webhooks SET round_robin_last_index = v_next WHERE id = p_webhook_id;
    RETURN v_members[v_next + 1];   -- pg arrays are 1-indexed
  END IF;

  -- Global pool fallback
  SELECT enabled, member_ids, last_index
    INTO v_enabled, v_members, v_idx
    FROM round_robin_config
   WHERE id = 1
     FOR UPDATE;

  IF v_enabled AND cardinality(v_members) > 0 THEN
    v_next := (v_idx + 1) % cardinality(v_members);
    UPDATE round_robin_config SET last_index = v_next, updated_at = NOW() WHERE id = 1;
    RETURN v_members[v_next + 1];
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 7. RLS
-- ============================================================

-- sources: read = signed in; write = admin
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sources read"  ON sources;
DROP POLICY IF EXISTS "sources write" ON sources;
CREATE POLICY "sources read"  ON sources
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sources write" ON sources
  FOR ALL USING (my_role() = 'admin') WITH CHECK (my_role() = 'admin');

-- round_robin_config: read = signed in; write = admin
ALTER TABLE round_robin_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rrc read"  ON round_robin_config;
DROP POLICY IF EXISTS "rrc write" ON round_robin_config;
CREATE POLICY "rrc read"  ON round_robin_config
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rrc write" ON round_robin_config
  FOR ALL USING (my_role() = 'admin') WITH CHECK (my_role() = 'admin');

-- webhooks: read = admin/owner/manager; write = admin
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhooks read"  ON webhooks;
DROP POLICY IF EXISTS "webhooks write" ON webhooks;
CREATE POLICY "webhooks read"  ON webhooks
  FOR SELECT USING (my_role() IN ('admin','owner','manager'));
CREATE POLICY "webhooks write" ON webhooks
  FOR ALL USING (my_role() = 'admin') WITH CHECK (my_role() = 'admin');

-- webhook_requests: read = admin/owner/manager; no client INSERT policy
-- (service-role bypasses RLS, which is the only intended writer)
ALTER TABLE webhook_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wreq read" ON webhook_requests;
CREATE POLICY "wreq read" ON webhook_requests
  FOR SELECT USING (my_role() IN ('admin','owner','manager'));
