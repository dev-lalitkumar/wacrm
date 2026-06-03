-- ============================================================
-- 041 – Audit log
--
-- Records sensitive team actions (role/status changes, user deletion,
-- contact merges, …) so owners can answer "who did what". Written
-- server-side via the service role; readable by admins/owners only.
-- actor_name is denormalised so the trail survives profile deletion.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name       text,
  action           text        NOT NULL,
  entity_type      text,
  entity_id        uuid,
  detail           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Read-only to leadership; inserts come from the service role (bypasses RLS).
DROP POLICY IF EXISTS "audit_log_read" ON audit_log;
CREATE POLICY "audit_log_read" ON audit_log
  FOR SELECT USING (my_role() IN ('admin', 'owner'));
