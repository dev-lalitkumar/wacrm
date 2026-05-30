-- ============================================================
-- 027 — Add profile picture to facebook_config
-- ============================================================
ALTER TABLE facebook_config ADD COLUMN IF NOT EXISTS fb_user_picture TEXT;
