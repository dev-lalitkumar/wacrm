-- ============================================================
-- 040 – Saved views / lead segments
--
-- Personal, named filter sets (e.g. "My hot leads", "Stale > 7 days").
-- `filters` is an opaque JSON blob the client serialises/applies.
-- Private to the owner.
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scope       text        NOT NULL DEFAULT 'contacts',
  name        text        NOT NULL,
  filters     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_owner ON saved_views (profile_id, scope);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_views_own" ON saved_views;
CREATE POLICY "saved_views_own" ON saved_views
  FOR ALL USING (profile_id = my_profile_id())
  WITH CHECK (profile_id = my_profile_id());
