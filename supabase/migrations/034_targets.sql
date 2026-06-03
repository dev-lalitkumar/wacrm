-- ============================================================
-- 034 – Sales targets / quotas (per rep, per month)
--
-- Lets owners/managers set a monthly target for each rep so the
-- dashboard and employee report can show attainment (actual ÷ target).
-- Primary metric is monthly won revenue ('revenue_won'); the `metric`
-- column leaves room for count-based targets ('deals_won') later.
--
-- Reuses update_updated_at_column() (001) and my_role()/my_profile_id() (013).
-- ============================================================

CREATE TABLE IF NOT EXISTS targets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Always the first day of the target month (e.g. 2026-06-01).
  period_month  date        NOT NULL,
  metric        text        NOT NULL DEFAULT 'revenue_won'
                            CHECK (metric IN ('revenue_won', 'deals_won')),
  target_value  numeric     NOT NULL DEFAULT 0 CHECK (target_value >= 0),
  created_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, period_month, metric)
);

CREATE INDEX IF NOT EXISTS idx_targets_profile_month ON targets (profile_id, period_month);

DROP TRIGGER IF EXISTS set_updated_at ON targets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

-- Managers/owners/admins read every target; a rep reads only their own.
DROP POLICY IF EXISTS "targets_select" ON targets;
CREATE POLICY "targets_select" ON targets
  FOR SELECT USING (
    my_role() IN ('admin', 'owner', 'manager')
    OR profile_id = my_profile_id()
  );

-- Only managers/owners/admins set or change targets.
DROP POLICY IF EXISTS "targets_write" ON targets;
CREATE POLICY "targets_write" ON targets
  FOR ALL USING (my_role() IN ('admin', 'owner', 'manager'))
  WITH CHECK (my_role() IN ('admin', 'owner', 'manager'));
