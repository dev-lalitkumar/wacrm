-- ============================================================
-- 043 — Inbound event queue (Vercel-safe webhook processing)
-- ============================================================

CREATE TABLE inbound_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type     TEXT NOT NULL
                  CHECK (source_type IN ('meta_leadgen', 'integration_webhook', 'public_form')),
  source_ref      TEXT,
  idempotency_key TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'success', 'failed', 'skipped', 'rejected')),
  auth_status     TEXT NOT NULL DEFAULT 'ok'
                  CHECK (auth_status IN ('ok', 'invalid_signature', 'invalid_secret', 'rate_limited', 'disabled')),
  raw_body        TEXT NOT NULL,
  headers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message   TEXT,
  result          JSONB NOT NULL DEFAULT '{}'::jsonb,
  claimed_by      TEXT,
  claimed_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_inbound_events_idempotency_success
  ON inbound_events (source_type, idempotency_key)
  WHERE status = 'success' AND idempotency_key IS NOT NULL;

CREATE INDEX idx_inbound_events_due
  ON inbound_events (next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_inbound_events_source_ref_received
  ON inbound_events (source_ref, received_at DESC);

CREATE INDEX idx_inbound_events_source_type_received
  ON inbound_events (source_type, received_at DESC);

ALTER TABLE inbound_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbound_events_select" ON inbound_events
  FOR SELECT USING (my_role() IN ('admin', 'owner'));

-- Service-role inserts/updates bypass RLS (webhook ingress + cron worker).

ALTER TABLE webhook_requests
  ADD COLUMN IF NOT EXISTS inbound_event_id UUID REFERENCES inbound_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_requests_inbound_event
  ON webhook_requests (inbound_event_id)
  WHERE inbound_event_id IS NOT NULL;

-- Atomically claim due events for the cron worker.
CREATE OR REPLACE FUNCTION public.claim_inbound_events(
  p_batch_size INTEGER,
  p_worker_id TEXT
)
RETURNS SETOF inbound_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE inbound_events e
  SET
    status = 'processing',
    claimed_by = p_worker_id,
    claimed_at = NOW(),
    attempt_count = e.attempt_count + 1
  FROM (
    SELECT id
    FROM inbound_events
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= NOW()
      AND attempt_count < max_attempts
    ORDER BY next_attempt_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_batch_size, 100))
  ) picked
  WHERE e.id = picked.id
  RETURNING e.*;
END;
$$;

ALTER FUNCTION public.claim_inbound_events(INTEGER, TEXT) OWNER TO postgres;
