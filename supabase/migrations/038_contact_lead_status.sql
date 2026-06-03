-- ============================================================
-- 038 – Contact-level lead status
--
-- A lightweight qualification status on the contact (we keep the implicit
-- "deal = lead" model — this just makes the pre-deal qualification stage
-- explicit and filterable). Defaults to 'new'.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'new'
    CHECK (lead_status IN ('new', 'contacted', 'qualified', 'unqualified', 'junk'));

CREATE INDEX IF NOT EXISTS idx_contacts_lead_status ON contacts (lead_status);
