-- ============================================================
-- 042_lead_fetch_sources.sql
--
-- Pull-based lead ingestion. Where webhooks ingest leads when a
-- provider PUSHES to us, a "fetch source" PULLS leads on a schedule
-- from a provider's read endpoint.
--
-- Adds:
--   • lead_fetch_sources — one row per polling integration (endpoint,
--     method, encrypted headers, templated query/body params, response
--     parsing config, field mappings, poll cadence, RR assignment)
--   • lead_fetch_seen_refs — per-source dedup ledger keyed by the
--     provider's record id (UNIQUE = the "don't re-import" guarantee +
--     atomic claim against overlapping poll runs)
--   • lead_fetch_runs — per-poll audit log (mirrors webhook_requests)
--   • pick_next_assignee_fetch() — RR rotation sibling of
--     pick_next_assignee(), reading the fetch source's override pool
--     then falling back to the same global round_robin_config singleton
--   • RLS mirroring webhooks: sources read = admin/owner/manager,
--     write = admin; runs + seen_refs read = admin/owner/manager,
--     service-role-only inserts.
-- ============================================================

-- ============================================================
-- 1. lead_fetch_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_fetch_sources (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     TEXT NOT NULL,
  source_id                UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,

  creates_deal             BOOLEAN NOT NULL DEFAULT TRUE,
  pipeline_id              UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  stage_id                 UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,

  -- ─── request config ───────────────────────────────────────
  endpoint_url             TEXT NOT NULL,
  http_method              TEXT NOT NULL DEFAULT 'GET' CHECK (http_method IN ('GET','POST')),
  -- AES-256-GCM ciphertext of a JSON array [{ "key": "...", "value": "..." }];
  -- may carry bearer tokens / API keys, so it is never stored in plaintext.
  headers_encrypted        TEXT,
  -- [{ "key": "created_after", "value_template": "{{now-24h|iso}}" }, ...]
  query_params             JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- For POST: a JSON object whose string leaves may contain {{placeholders}}.
  body_template            JSONB,

  -- ─── response parsing ─────────────────────────────────────
  -- Dot path to the lead array inside the response; NULL/empty ⇒ the
  -- response body IS the array.
  items_path               TEXT,
  -- Path within each item used as the dedup key, e.g. "$.id".
  ref_id_path              TEXT NOT NULL,
  -- Same { contact, deal } shape as webhooks.field_mappings.
  field_mappings           JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- ─── scheduling ───────────────────────────────────────────
  poll_interval_minutes    INTEGER NOT NULL CHECK (poll_interval_minutes IN (1,5,10,20)),
  last_polled_at           TIMESTAMPTZ,
  -- NULL or <= now() ⇒ due to run.
  next_poll_at             TIMESTAMPTZ,
  -- Start time of the last successful poll; feeds the {{last_fetch}} placeholder.
  last_cursor              TIMESTAMPTZ,
  last_status              TEXT NOT NULL DEFAULT 'idle'
                           CHECK (last_status IN ('idle','ok','error','partial')),
  last_error               TEXT,

  -- ─── assignment (mirror webhooks columns) ─────────────────
  round_robin_override     BOOLEAN NOT NULL DEFAULT FALSE,
  round_robin_member_ids   UUID[] NOT NULL DEFAULT '{}',
  round_robin_last_index   INTEGER NOT NULL DEFAULT -1,

  created_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cron query: active sources that are due.
CREATE INDEX IF NOT EXISTS idx_lead_fetch_sources_due
  ON lead_fetch_sources (is_active, next_poll_at);

-- ============================================================
-- 2. lead_fetch_seen_refs — dedup ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_fetch_seen_refs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fetch_source_id     UUID NOT NULL REFERENCES lead_fetch_sources(id) ON DELETE CASCADE,
  ref_id              TEXT NOT NULL,
  created_contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL,
  seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The dedup guarantee. Also used to atomically "claim" a ref so two
  -- overlapping poll runs can't both import the same provider record.
  UNIQUE (fetch_source_id, ref_id)
);

-- ============================================================
-- 3. lead_fetch_runs — per-poll audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_fetch_runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fetch_source_id     UUID NOT NULL REFERENCES lead_fetch_sources(id) ON DELETE CASCADE,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT NOT NULL CHECK (status IN ('ok','error','partial','disabled')),
  http_status         INTEGER,
  -- Resolved URL incl. rendered query params. Headers are NEVER stored.
  resolved_url        TEXT,
  items_fetched       INTEGER NOT NULL DEFAULT 0,
  items_created       INTEGER NOT NULL DEFAULT 0,
  items_skipped       INTEGER NOT NULL DEFAULT 0,
  items_failed        INTEGER NOT NULL DEFAULT 0,
  error_message       TEXT,
  response_preview    TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_fetch_runs_recent
  ON lead_fetch_runs (fetch_source_id, started_at DESC);

-- ============================================================
-- 4. pick_next_assignee_fetch() — atomic RR rotation
--    Priority: per-source override → global pool → NULL.
--    Mirrors pick_next_assignee() (migration 015).
-- ============================================================
CREATE OR REPLACE FUNCTION public.pick_next_assignee_fetch(p_fetch_id UUID)
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
  -- Per-source override path
  SELECT round_robin_override, round_robin_member_ids, round_robin_last_index
    INTO v_override, v_members, v_idx
    FROM lead_fetch_sources
   WHERE id = p_fetch_id
     FOR UPDATE;

  IF v_override AND cardinality(v_members) > 0 THEN
    v_next := (v_idx + 1) % cardinality(v_members);
    UPDATE lead_fetch_sources SET round_robin_last_index = v_next WHERE id = p_fetch_id;
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
-- 5. RLS
-- ============================================================

-- lead_fetch_sources: read = admin/owner/manager; write = admin
ALTER TABLE lead_fetch_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_fetch_sources read"  ON lead_fetch_sources;
DROP POLICY IF EXISTS "lead_fetch_sources write" ON lead_fetch_sources;
CREATE POLICY "lead_fetch_sources read"  ON lead_fetch_sources
  FOR SELECT USING (my_role() IN ('admin','owner','manager'));
CREATE POLICY "lead_fetch_sources write" ON lead_fetch_sources
  FOR ALL USING (my_role() = 'admin') WITH CHECK (my_role() = 'admin');

-- lead_fetch_runs: read = admin/owner/manager; service-role-only inserts
ALTER TABLE lead_fetch_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_fetch_runs read" ON lead_fetch_runs;
CREATE POLICY "lead_fetch_runs read" ON lead_fetch_runs
  FOR SELECT USING (my_role() IN ('admin','owner','manager'));

-- lead_fetch_seen_refs: read = admin/owner/manager; service-role-only writes
ALTER TABLE lead_fetch_seen_refs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_fetch_seen_refs read" ON lead_fetch_seen_refs;
CREATE POLICY "lead_fetch_seen_refs read" ON lead_fetch_seen_refs
  FOR SELECT USING (my_role() IN ('admin','owner','manager'));
