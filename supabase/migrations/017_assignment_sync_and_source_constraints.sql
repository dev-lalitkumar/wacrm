-- Migration 017: Bidirectional assignment sync + source immutability + source NOT NULL
--
-- 1. When a deal's assigned_to changes → sync to its linked contact.
-- 2. When a contact's assigned_to changes → sync to all their deals (open + closed).
-- 3. source_id is immutable once set on contacts or deals.
-- 4. source_id is made NOT NULL on contacts + deals (015 already backfilled Direct).
--
-- Loop safety: every UPDATE uses `WHERE … IS DISTINCT FROM NEW.assigned_to`
-- so a row already carrying the new value is never touched → no trigger recursion.

-- ─── 1. Deal → contact assignment sync ─────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_contact_assignment_from_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.contact_id IS NOT NULL
  THEN
    UPDATE contacts
       SET assigned_to = NEW.assigned_to
     WHERE id = NEW.contact_id
       AND assigned_to IS DISTINCT FROM NEW.assigned_to;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_sync_contact_assignment ON deals;
CREATE TRIGGER trg_deal_sync_contact_assignment
  AFTER UPDATE OF assigned_to ON deals
  FOR EACH ROW EXECUTE FUNCTION sync_contact_assignment_from_deal();

-- ─── 2. Contact → deals assignment sync ────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_deals_assignment_from_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    UPDATE deals
       SET assigned_to = NEW.assigned_to
     WHERE contact_id = NEW.id
       AND assigned_to IS DISTINCT FROM NEW.assigned_to;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_sync_deal_assignment ON contacts;
CREATE TRIGGER trg_contact_sync_deal_assignment
  AFTER UPDATE OF assigned_to ON contacts
  FOR EACH ROW EXECUTE FUNCTION sync_deals_assignment_from_contact();

-- ─── 3. Source immutability ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_immutable_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.source_id IS NOT NULL
     AND NEW.source_id IS DISTINCT FROM OLD.source_id
  THEN
    RAISE EXCEPTION 'source_id is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_immutable_source ON contacts;
CREATE TRIGGER trg_contacts_immutable_source
  BEFORE UPDATE OF source_id ON contacts
  FOR EACH ROW EXECUTE FUNCTION enforce_immutable_source();

DROP TRIGGER IF EXISTS trg_deals_immutable_source ON deals;
CREATE TRIGGER trg_deals_immutable_source
  BEFORE UPDATE OF source_id ON deals
  FOR EACH ROW EXECUTE FUNCTION enforce_immutable_source();

-- ─── 4. source_id NOT NULL ──────────────────────────────────────────────────

-- Backfill any remaining NULLs (015 should already have done this)
UPDATE contacts
   SET source_id = (SELECT id FROM sources WHERE key = 'direct')
 WHERE source_id IS NULL;

UPDATE deals
   SET source_id = (SELECT id FROM sources WHERE key = 'direct')
 WHERE source_id IS NULL;

ALTER TABLE contacts ALTER COLUMN source_id SET NOT NULL;
ALTER TABLE deals    ALTER COLUMN source_id SET NOT NULL;
