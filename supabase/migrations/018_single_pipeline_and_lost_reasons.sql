-- ============================================================
-- Migration 018: Single Fixed Pipeline + Lost Reasons Master
-- ============================================================

-- ─── A. Wipe + re-seed pipeline data ────────────────────────
-- Wipe all existing pipeline data (fresh start confirmed by user)
TRUNCATE deals RESTART IDENTITY CASCADE;           -- also clears deal_followups, reminders, etc via CASCADE
TRUNCATE pipeline_stages RESTART IDENTITY CASCADE;
TRUNCATE pipelines RESTART IDENTITY CASCADE;

-- Seed the one fixed pipeline (well-known UUID for app-level reference)
INSERT INTO pipelines (id, name, user_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sales Pipeline',
  (SELECT user_id FROM profiles WHERE role = 'admin' LIMIT 1)
);

-- Seed 5 fixed stages (position order = funnel order)
INSERT INTO pipeline_stages (pipeline_id, name, position, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'New',           1, '#3b82f6'),
  ('00000000-0000-0000-0000-000000000001', 'Qualified',     2, '#eab308'),
  ('00000000-0000-0000-0000-000000000001', 'Proposal Sent', 3, '#f97316'),
  ('00000000-0000-0000-0000-000000000001', 'Negotiation',   4, '#8b5cf6'),
  ('00000000-0000-0000-0000-000000000001', 'Won',           5, '#22c55e');

-- ─── B. Lost reasons table ───────────────────────────────────
CREATE TABLE lost_reasons (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reason     TEXT        NOT NULL UNIQUE,
  is_system  BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-seeded system defaults
INSERT INTO lost_reasons (reason, is_system, sort_order) VALUES
  ('Invalid Contact Details', TRUE, 1),
  ('Duplicate Lead',          TRUE, 2),
  ('Gone With Competitor',    TRUE, 3),
  ('Price Issue',             TRUE, 4),
  ('No Budget / Not Ready',   TRUE, 5);

-- Protect system rows from deletion (same pattern as sources)
CREATE OR REPLACE FUNCTION protect_system_lost_reasons()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_system THEN
    RAISE EXCEPTION 'System lost reasons cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_system AND NEW.is_system <> OLD.is_system THEN
    RAISE EXCEPTION 'System lost reason is_system flag is immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_protect_system_lost_reasons
  BEFORE UPDATE OR DELETE ON lost_reasons
  FOR EACH ROW EXECUTE FUNCTION protect_system_lost_reasons();

-- RLS
ALTER TABLE lost_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lost_reasons read"  ON lost_reasons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "lost_reasons write" ON lost_reasons FOR ALL
  USING (my_role() = 'admin') WITH CHECK (my_role() = 'admin');

-- ─── C. Add lost_reason_id to deals ─────────────────────────
ALTER TABLE deals
  ADD COLUMN lost_reason_id UUID REFERENCES lost_reasons(id) ON DELETE SET NULL;

-- Enforce: lost deals must have a reason; clear reason when reopening
CREATE OR REPLACE FUNCTION enforce_lost_reason()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'lost' AND NEW.lost_reason_id IS NULL THEN
    RAISE EXCEPTION 'lost_reason_id is required when marking a deal as lost';
  END IF;
  -- Auto-clear lost_reason_id when deal is reopened (won → open or lost → open)
  IF NEW.status <> 'lost' AND (OLD.status = 'lost' OR OLD.status = 'won') THEN
    NEW.lost_reason_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_lost_reason
  BEFORE UPDATE OF status ON deals
  FOR EACH ROW EXECUTE FUNCTION enforce_lost_reason();
