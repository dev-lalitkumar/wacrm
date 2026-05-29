-- ============================================================
-- 022 – Deal close tracking + RLS security fixes
--
-- 1. Add closed_at / closed_by columns to deals
-- 2. Backfill closed_at for existing closed deals
-- 3. Trigger to auto-set closed_at on close, auto-clear on reopen
-- 4. Fix deals write RLS policy (was overly permissive)
-- 5. Fix conversations write RLS policy (same issue)
-- ============================================================

-- ── 1. New columns ──────────────────────────────────────────

ALTER TABLE deals ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 2. Backfill: use updated_at as best approximation ───────

UPDATE deals
SET closed_at = updated_at
WHERE status IN ('won', 'lost')
  AND closed_at IS NULL;

-- ── 3. Trigger: auto-set closed_at / auto-clear on reopen ──

CREATE OR REPLACE FUNCTION set_closed_at_on_close()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Deal is being closed (open → won/lost)
  IF NEW.status IN ('won', 'lost') AND OLD.status = 'open' THEN
    NEW.closed_at := NOW();
    -- closed_by is expected to be set by the client in the UPDATE payload.
    -- If not provided, it stays NULL (acceptable for webhook/automation closes).
  END IF;

  -- Deal is being reopened (won/lost → open)
  IF NEW.status = 'open' AND OLD.status IN ('won', 'lost') THEN
    NEW.closed_at := NULL;
    NEW.closed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_closed_at
  BEFORE UPDATE OF status ON deals
  FOR EACH ROW
  EXECUTE FUNCTION set_closed_at_on_close();

-- ── 4. Fix deals write policy ───────────────────────────────
-- Previously: any authenticated user could write any deal.
-- Now: admin/owner/manager can write all; executive only own.

DROP POLICY IF EXISTS "deals write" ON deals;
CREATE POLICY "deals write" ON deals FOR ALL
  USING (
    my_role() IN ('admin','owner','manager')
    OR assigned_to = my_profile_id()
  )
  WITH CHECK (
    my_role() IN ('admin','owner','manager')
    OR assigned_to = my_profile_id()
  );

-- ── 5. Fix conversations write policy ───────────────────────
-- Same issue as deals — tighten to assignment-scoped.

DROP POLICY IF EXISTS "conversations write" ON conversations;
CREATE POLICY "conversations write" ON conversations FOR ALL
  USING (
    my_role() IN ('admin','owner','manager')
    OR assigned_agent_id = auth.uid()
  )
  WITH CHECK (
    my_role() IN ('admin','owner','manager')
    OR assigned_agent_id = auth.uid()
  );
