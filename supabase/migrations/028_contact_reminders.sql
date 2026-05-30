-- ============================================================
-- 028_contact_reminders.sql
--
-- Adds reminder columns to contacts table (same pattern as deals).
-- Allows scheduling follow-up reminders directly on contacts.
-- ============================================================

-- ── 1. Reminder columns on contacts ──────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS reminder_type       deal_reminder_type,
  ADD COLUMN IF NOT EXISTS reminder_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_note       TEXT,
  ADD COLUMN IF NOT EXISTS reminder_updated_at TIMESTAMPTZ;

-- ── 2. Index for reminder queries (overdue / upcoming) ───────
CREATE INDEX IF NOT EXISTS idx_contacts_reminder
  ON contacts (assigned_to, reminder_at)
  WHERE reminder_at IS NOT NULL;
