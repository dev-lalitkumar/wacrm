-- ============================================================
-- 014_followups_reminders_customfields.sql
--
-- Adds:
--   • followup_channel / deal_reminder_type enums
--   • deal_followups + contact_followups tables
--   • reminder columns on deals
--   • custom_data JSONB on contacts + deals
--   • updated custom_fields schema (applies_to, sort_order, field_type constraint)
--   • DB triggers: auto-seed reminder on new open deal, reseed on reopen,
--     default assigned_to = creator on contacts + deals
--   • RLS for the two new tables; tighten custom_fields + pipelines to admin-only
--   • Data migration: contact_custom_values → contacts.custom_data
-- ============================================================

-- ============================================================
-- 1. Enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE followup_channel AS ENUM ('whatsapp','call','email','meeting','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deal_reminder_type AS ENUM ('followup','call','meeting','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. deal_followups table
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_followups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  channel     followup_channel NOT NULL,
  note        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_followups_deal_created
  ON deal_followups (deal_id, created_at DESC);

ALTER TABLE deal_followups ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. contact_followups table
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_followups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel     followup_channel NOT NULL,
  note        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_followups_contact_created
  ON contact_followups (contact_id, created_at DESC);

ALTER TABLE contact_followups ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Reminder columns on deals
-- ============================================================
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS reminder_type       deal_reminder_type,
  ADD COLUMN IF NOT EXISTS reminder_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_note       TEXT,
  ADD COLUMN IF NOT EXISTS reminder_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deals_reminder
  ON deals (assigned_to, status, reminder_at)
  WHERE status = 'open';

-- ============================================================
-- 5. custom_data JSONB on contacts and deals
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

-- ============================================================
-- 6. Update custom_fields schema
-- ============================================================

-- Add applies_to column (defaults to 'contact' for all existing rows)
ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'contact';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_fields_applies_to_check'
      AND conrelid = 'custom_fields'::regclass
  ) THEN
    ALTER TABLE custom_fields
      ADD CONSTRAINT custom_fields_applies_to_check
      CHECK (applies_to IN ('contact','deal'));
  END IF;
END $$;

-- Add sort_order column
ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 7. Migrate contact_custom_values → contacts.custom_data
-- ============================================================
UPDATE contacts c
SET custom_data = sub.data
FROM (
  SELECT contact_id,
         jsonb_object_agg(custom_field_id::text, value) AS data
  FROM contact_custom_values
  WHERE value IS NOT NULL AND value != ''
  GROUP BY contact_id
) sub
WHERE c.id = sub.contact_id;

-- ============================================================
-- 8. Trigger: auto-seed reminder on new open deal
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_deal_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'open' AND NEW.reminder_at IS NULL THEN
    NEW.reminder_type       := 'followup';
    NEW.reminder_at         := NOW() + INTERVAL '1 minute';
    NEW.reminder_note       := 'Initial follow-up';
    NEW.reminder_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_deal_reminder ON deals;
CREATE TRIGGER trg_seed_deal_reminder
  BEFORE INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION public.seed_deal_reminder();

-- ============================================================
-- 9. Trigger: reseed reminder when deal is reopened
-- ============================================================
CREATE OR REPLACE FUNCTION public.reseed_deal_reminder_on_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status != 'open' AND NEW.status = 'open' AND NEW.reminder_at IS NULL THEN
    NEW.reminder_type       := 'followup';
    NEW.reminder_at         := NOW() + INTERVAL '1 minute';
    NEW.reminder_note       := 'Follow-up after reopen';
    NEW.reminder_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reseed_deal_reminder_reopen ON deals;
CREATE TRIGGER trg_reseed_deal_reminder_reopen
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION public.reseed_deal_reminder_on_reopen();

-- ============================================================
-- 10. Trigger: default assigned_to = creator on deals
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_deals_assigned_to_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := my_profile_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_assigned_to_creator ON deals;
CREATE TRIGGER trg_deals_assigned_to_creator
  BEFORE INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION public.set_deals_assigned_to_creator();

-- ============================================================
-- 11. Trigger: default assigned_to = creator on contacts
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_contacts_assigned_to_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := my_profile_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_assigned_to_creator ON contacts;
CREATE TRIGGER trg_contacts_assigned_to_creator
  BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_contacts_assigned_to_creator();

-- ============================================================
-- 12. RLS for deal_followups
--     Mirrors deals visibility:
--       admin/owner/manager = all
--       executive = only deals assigned to them
-- ============================================================
DROP POLICY IF EXISTS "deal_followups read"  ON deal_followups;
DROP POLICY IF EXISTS "deal_followups write" ON deal_followups;

CREATE POLICY "deal_followups read" ON deal_followups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_followups.deal_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR d.assigned_to = my_profile_id()
        )
    )
  );

CREATE POLICY "deal_followups write" ON deal_followups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_followups.deal_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR d.assigned_to = my_profile_id()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_followups.deal_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR d.assigned_to = my_profile_id()
        )
    )
  );

-- ============================================================
-- 13. RLS for contact_followups
--     Mirrors contacts visibility
-- ============================================================
DROP POLICY IF EXISTS "contact_followups read"  ON contact_followups;
DROP POLICY IF EXISTS "contact_followups write" ON contact_followups;

CREATE POLICY "contact_followups read" ON contact_followups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_followups.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );

CREATE POLICY "contact_followups write" ON contact_followups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_followups.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_followups.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );

-- ============================================================
-- 14. Tighten custom_fields write to admin-only
-- ============================================================
DROP POLICY IF EXISTS "custom_fields write" ON custom_fields;

CREATE POLICY "custom_fields write" ON custom_fields FOR ALL
  USING (my_role() = 'admin')
  WITH CHECK (my_role() = 'admin');

-- ============================================================
-- 15. Tighten pipelines + pipeline_stages write to admin-only
-- ============================================================
DROP POLICY IF EXISTS "pipelines write" ON pipelines;

CREATE POLICY "pipelines write" ON pipelines FOR ALL
  USING (my_role() = 'admin')
  WITH CHECK (my_role() = 'admin');

DROP POLICY IF EXISTS "pipeline_stages write" ON pipeline_stages;

CREATE POLICY "pipeline_stages write" ON pipeline_stages FOR ALL
  USING (my_role() = 'admin')
  WITH CHECK (my_role() = 'admin');
