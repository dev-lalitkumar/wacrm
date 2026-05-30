-- ============================================================
-- 027_merge_followups.sql
--
-- Merges deal_followups + contact_followups into a single
-- `followups` table with:
--   contact_id  NOT NULL  (every followup is a contact interaction)
--   deal_id     NULLABLE  (optional deal association)
--
-- Also enforces deals.contact_id NOT NULL and changes cascade
-- from ON DELETE SET NULL → ON DELETE RESTRICT.
-- ============================================================

-- ============================================================
-- 0. Safety check — abort if any deals lack a contact
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM deals WHERE contact_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot run migration: some deals have contact_id = NULL. Please clean them up first.';
  END IF;
END $$;

-- ============================================================
-- 1. Enforce deals.contact_id NOT NULL + ON DELETE RESTRICT
-- ============================================================

-- Drop the existing FK (named in migration 004)
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_contact_id_fkey;

-- Set column NOT NULL
ALTER TABLE deals ALTER COLUMN contact_id SET NOT NULL;

-- Recreate FK with RESTRICT (prevent deleting contacts that have deals)
ALTER TABLE deals
  ADD CONSTRAINT deals_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT;

-- ============================================================
-- 2. Create unified followups table
-- ============================================================
CREATE TABLE IF NOT EXISTS followups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id    UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id       UUID REFERENCES deals(id) ON DELETE SET NULL,
  channel       followup_channel NOT NULL,
  note          TEXT NOT NULL,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_log_id   UUID REFERENCES telephony_call_logs(id) ON DELETE SET NULL,
  recording_url TEXT,
  call_duration INTEGER
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_followups_contact_created
  ON followups (contact_id, created_at DESC);

-- Partial index for deal-scoped queries (only rows with a deal)
CREATE INDEX IF NOT EXISTS idx_followups_deal_created
  ON followups (deal_id, created_at DESC)
  WHERE deal_id IS NOT NULL;

-- For leaderboard / report queries by creator
CREATE INDEX IF NOT EXISTS idx_followups_createdby_created
  ON followups (created_by, created_at DESC);

-- ============================================================
-- 4. Migrate data from contact_followups → followups
-- ============================================================
INSERT INTO followups (id, contact_id, deal_id, channel, note, created_by, created_at, call_log_id, recording_url, call_duration)
SELECT
  cf.id,
  cf.contact_id,
  NULL,                  -- no deal association
  cf.channel,
  cf.note,
  cf.created_by,
  cf.created_at,
  cf.call_log_id,
  cf.recording_url,
  cf.call_duration
FROM contact_followups cf;

-- ============================================================
-- 5. Migrate data from deal_followups → followups
--    Join deals to resolve contact_id.
--    Use ON CONFLICT to skip telephony duplicates (same id won't
--    appear, but same call_log_id + contact_id would). We generate
--    new UUIDs to avoid PK collision with contact_followups rows.
-- ============================================================
INSERT INTO followups (id, contact_id, deal_id, channel, note, created_by, created_at, call_log_id, recording_url, call_duration)
SELECT
  uuid_generate_v4(),   -- new UUID (avoid PK collision with contact_followups rows)
  d.contact_id,
  df.deal_id,
  df.channel,
  df.note,
  df.created_by,
  df.created_at,
  df.call_log_id,
  df.recording_url,
  df.call_duration
FROM deal_followups df
JOIN deals d ON d.id = df.deal_id;

-- ============================================================
-- 6. De-duplicate telephony rows
--    The telephony webhook wrote the same call event to BOTH tables.
--    After merging, we have two rows for the same call_log_id + contact_id.
--    Keep the one with deal_id set (more context), delete the other.
-- ============================================================
DELETE FROM followups f1
USING followups f2
WHERE f1.call_log_id IS NOT NULL
  AND f1.call_log_id = f2.call_log_id
  AND f1.contact_id  = f2.contact_id
  AND f1.id != f2.id
  AND f1.deal_id IS NULL        -- remove the contact-only duplicate
  AND f2.deal_id IS NOT NULL;   -- keep the deal-linked one

-- ============================================================
-- 7. RLS
-- ============================================================
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "followups read"  ON followups;
DROP POLICY IF EXISTS "followups write" ON followups;

CREATE POLICY "followups read" ON followups FOR SELECT
  USING (
    my_role() IN ('admin', 'owner', 'manager')
    OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = followups.contact_id
        AND c.assigned_to = my_profile_id()
    )
    OR (
      followups.deal_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = followups.deal_id
          AND d.assigned_to = my_profile_id()
      )
    )
  );

CREATE POLICY "followups write" ON followups FOR ALL
  USING (
    my_role() IN ('admin', 'owner', 'manager')
    OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = followups.contact_id
        AND c.assigned_to = my_profile_id()
    )
    OR (
      followups.deal_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = followups.deal_id
          AND d.assigned_to = my_profile_id()
      )
    )
  )
  WITH CHECK (
    my_role() IN ('admin', 'owner', 'manager')
    OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = followups.contact_id
        AND c.assigned_to = my_profile_id()
    )
    OR (
      followups.deal_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = followups.deal_id
          AND d.assigned_to = my_profile_id()
      )
    )
  );

-- ============================================================
-- 8. Drop old tables
-- ============================================================
DROP TABLE IF EXISTS deal_followups;
DROP TABLE IF EXISTS contact_followups;
