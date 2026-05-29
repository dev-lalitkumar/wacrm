-- ============================================================
-- 025 — Meta Data Deletion Requests
-- ============================================================
-- Stores Facebook user data deletion requests received via
-- Meta's Data Deletion Callback URL.
-- Admins review and process these manually (Option A).
-- ============================================================

CREATE TABLE meta_data_deletion_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code TEXT        NOT NULL UNIQUE,
  fb_user_id        TEXT        NOT NULL,
  -- 'pending' | 'in_progress' | 'completed'
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed')),
  raw_payload       JSONB,
  processed_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  processed_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deletion_requests_status  ON meta_data_deletion_requests(status);
CREATE INDEX idx_deletion_requests_fb_user ON meta_data_deletion_requests(fb_user_id);

ALTER TABLE meta_data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deletion_requests_select" ON meta_data_deletion_requests
  FOR SELECT USING (my_role() IN ('admin', 'owner'));

CREATE POLICY "deletion_requests_modify" ON meta_data_deletion_requests
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));

-- Public INSERT via API route (uses service-role, bypasses RLS).
