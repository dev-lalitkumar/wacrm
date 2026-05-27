-- ============================================================
-- Migration 019: Company entity + logo storage bucket
-- ============================================================
-- Singleton design (id=1 only) — same pattern as round_robin_config
-- in migration 015. Holds the org-level branding (name, logo) shown
-- in the sidebar plus contact/legal details for invoices etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id         INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name       TEXT        NOT NULL DEFAULT 'My Company',
  logo_url   TEXT,
  website    TEXT,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  tax_id     TEXT,
  updated_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the single row
INSERT INTO companies (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Touch updated_at on any update
CREATE OR REPLACE FUNCTION touch_companies_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_companies_updated_at ON companies;
CREATE TRIGGER trg_touch_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION touch_companies_updated_at();

-- RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies read"  ON companies;
DROP POLICY IF EXISTS "companies write" ON companies;

-- Read: any signed-in user (sidebar needs name+logo for every role)
CREATE POLICY "companies read"  ON companies FOR SELECT
  USING (auth.role() = 'authenticated');

-- Write: admin + owner only
CREATE POLICY "companies write" ON companies FOR ALL
  USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));

-- ─── Storage bucket: company-logos ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  TRUE,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Company logos are publicly readable" ON storage.objects;
CREATE POLICY "Company logos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

-- Only admin/owner can mutate the logo
DROP POLICY IF EXISTS "Admins/Owners can upload company logo" ON storage.objects;
CREATE POLICY "Admins/Owners can upload company logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-logos'
    AND my_role() IN ('admin', 'owner')
  );

DROP POLICY IF EXISTS "Admins/Owners can update company logo" ON storage.objects;
CREATE POLICY "Admins/Owners can update company logo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'company-logos'
    AND my_role() IN ('admin', 'owner')
  );

DROP POLICY IF EXISTS "Admins/Owners can delete company logo" ON storage.objects;
CREATE POLICY "Admins/Owners can delete company logo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'company-logos'
    AND my_role() IN ('admin', 'owner')
  );
