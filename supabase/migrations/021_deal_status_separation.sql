-- ============================================================
-- 021 – Separate deal status (open/won/lost) from pipeline stages
--
-- Pipeline stages become purely about progression:
--   New → Qualified → Proposal Sent → Negotiation
--
-- The "Won" stage (position 5) is removed. Deal outcome is
-- tracked solely via the existing `status` column.
--
-- Also adds a trigger to auto-clear reminders when a deal
-- is marked as won or lost.
-- ============================================================

-- 1. Move deals that are currently on the "Won" stage → Negotiation
UPDATE deals
SET stage_id = (
  SELECT id FROM pipeline_stages
  WHERE pipeline_id = '00000000-0000-0000-0000-000000000001'
    AND position = 4
  LIMIT 1
)
WHERE stage_id = (
  SELECT id FROM pipeline_stages
  WHERE pipeline_id = '00000000-0000-0000-0000-000000000001'
    AND position = 5
  LIMIT 1
);

-- 2. Fix any webhooks referencing the Won stage → point to first stage (New)
UPDATE webhooks
SET stage_id = (
  SELECT id FROM pipeline_stages
  WHERE pipeline_id = '00000000-0000-0000-0000-000000000001'
    AND position = 1
  LIMIT 1
)
WHERE stage_id = (
  SELECT id FROM pipeline_stages
  WHERE pipeline_id = '00000000-0000-0000-0000-000000000001'
    AND position = 5
  LIMIT 1
);

-- 3. Delete the Won stage
DELETE FROM pipeline_stages
WHERE pipeline_id = '00000000-0000-0000-0000-000000000001'
  AND position = 5;

-- ────────────────────────────────────────────────────────────
-- 4. Auto-clear reminders when a deal is closed (won or lost)
--
-- The existing `reseed_deal_reminder_on_reopen` trigger (014)
-- already handles the reverse — re-seeding reminders when a
-- deal is reopened.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION clear_reminder_on_close()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') AND OLD.status = 'open' THEN
    NEW.reminder_type       := NULL;
    NEW.reminder_at         := NULL;
    NEW.reminder_note       := NULL;
    NEW.reminder_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clear_reminder_on_close
  BEFORE UPDATE OF status ON deals
  FOR EACH ROW
  EXECUTE FUNCTION clear_reminder_on_close();
