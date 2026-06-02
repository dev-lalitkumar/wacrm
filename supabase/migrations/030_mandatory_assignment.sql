-- ============================================================
-- Migration 030: Mandatory assignment
-- No deal or contact may ever exist unassigned.
--
-- App-layer guards (forms + API routes) already prevent an
-- authenticated user from clearing an owner. This migration adds
-- the hard guarantee at the database level so *no* path — including
-- the service-role webhook / Facebook-lead pipeline, which today
-- inserts rows with assigned_to = NULL — can leave a record ownerless.
--
-- Decisions (confirmed with product owner):
--   • Fallback owner for unattributed leads + existing NULLs:
--       first active 'owner', else first active 'admin'.
--   • assigned_to becomes NOT NULL.
--   • FK ON DELETE SET NULL → RESTRICT: a profile that still owns
--     deals/contacts cannot be hard-deleted (reassign first). The
--     app soft-deletes users (is_active = FALSE), so this only
--     blocks genuine hard deletes.
-- ============================================================

-- ─── 1. Default assignee resolver ───────────────────────────
-- SECURITY DEFINER so it sees all profiles regardless of the
-- caller's RLS scope (e.g. service-role webhook context).
CREATE OR REPLACE FUNCTION public.default_assignee_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
    FROM profiles
   WHERE is_active = TRUE
     AND role IN ('owner', 'admin')
   ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at
   LIMIT 1;
$$;

ALTER FUNCTION public.default_assignee_id() OWNER TO postgres;

-- ─── 2. Insert-default triggers fall back to default_assignee_id() ──
-- Authenticated app inserts still resolve to the creator via
-- my_profile_id(); service-role inserts (auth.uid() IS NULL) now
-- resolve to the workspace fallback owner instead of staying NULL.
CREATE OR REPLACE FUNCTION public.set_deals_assigned_to_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := COALESCE(my_profile_id(), default_assignee_id());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_contacts_assigned_to_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := COALESCE(my_profile_id(), default_assignee_id());
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 3. Backfill existing unassigned rows ───────────────────
DO $$
DECLARE
  v_default UUID := public.default_assignee_id();
  v_orphans INTEGER;
BEGIN
  SELECT count(*) INTO v_orphans
    FROM (
      SELECT 1 FROM deals    WHERE assigned_to IS NULL
      UNION ALL
      SELECT 1 FROM contacts WHERE assigned_to IS NULL
    ) t;

  IF v_orphans > 0 AND v_default IS NULL THEN
    RAISE EXCEPTION
      'Cannot enforce mandatory assignment: % unassigned row(s) exist but no active owner/admin profile is available to receive them.',
      v_orphans;
  END IF;

  UPDATE deals    SET assigned_to = v_default WHERE assigned_to IS NULL;
  UPDATE contacts SET assigned_to = v_default WHERE assigned_to IS NULL;
END $$;

-- ─── 4. FK: ON DELETE SET NULL → RESTRICT ───────────────────
-- Constraint names follow Postgres' auto-generated convention
-- (<table>_<column>_fkey); the deals one is referenced elsewhere
-- as deals_assigned_to_fkey.
ALTER TABLE deals    DROP CONSTRAINT IF EXISTS deals_assigned_to_fkey;
ALTER TABLE deals
  ADD CONSTRAINT deals_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_assigned_to_fkey;
ALTER TABLE contacts
  ADD CONSTRAINT contacts_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE RESTRICT;

-- ─── 5. Enforce NOT NULL ────────────────────────────────────
ALTER TABLE deals    ALTER COLUMN assigned_to SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN assigned_to SET NOT NULL;
