-- ============================================================
-- 032 – Mandatory rolling reminder on open deals
--
-- Philosophy: a lead must never go dark. Every OPEN deal must
-- always carry a future reminder (the "next step"). A reminder
-- can only be resolved by scheduling the next one — it can never
-- be cleared while the deal is still open.
--
-- What already exists (do not duplicate):
--   • 014 seed_deal_reminder()            — seeds a reminder on INSERT
--   • 014 reseed_deal_reminder_on_reopen()— reseeds when reopened
--   • 021 clear_reminder_on_close()       — clears reminder on won/lost
--
-- The only remaining hole is the UPDATE path: an open deal could
-- have its reminder_at set to NULL (e.g. a stray client write).
-- This migration closes that hole with a backstop trigger, and
-- backfills any open deals that are currently missing a reminder.
-- ============================================================

-- 1. Backfill: any open deal without a reminder gets one now so the
--    guard below can never trip on legacy rows.
UPDATE deals
SET reminder_type       = COALESCE(reminder_type, 'followup'),
    reminder_at         = NOW() + INTERVAL '1 day',
    reminder_note       = COALESCE(reminder_note, 'Next follow-up'),
    reminder_updated_at = NOW()
WHERE status = 'open'
  AND reminder_at IS NULL;

-- 2. Backstop trigger: refuse to leave an open deal without a future
--    reminder. Fires AFTER the close/reopen triggers (named so it sorts
--    last alphabetically is not required — we explicitly re-check status),
--    so closing a deal (which nulls the reminder) is still allowed.
CREATE OR REPLACE FUNCTION public.enforce_open_deal_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only guard deals that remain open after this update.
  IF NEW.status = 'open' AND NEW.reminder_at IS NULL THEN
    RAISE EXCEPTION 'Open deals must keep a reminder — schedule the next step before clearing the current one'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE UPDATE. Postgres fires same-event triggers in alphabetical order by
-- name, so the 'trg_zz_' prefix guarantees this guard runs LAST — after both
-- clear_reminder_on_close (closing nulls the reminder, but NEW.status is then
-- won/lost so the guard is skipped) and reseed_deal_reminder_on_reopen
-- (reopening restores a reminder before the guard checks it).
DROP TRIGGER IF EXISTS trg_enforce_open_deal_reminder ON deals;
DROP TRIGGER IF EXISTS trg_zz_enforce_open_deal_reminder ON deals;
CREATE TRIGGER trg_zz_enforce_open_deal_reminder
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_open_deal_reminder();
