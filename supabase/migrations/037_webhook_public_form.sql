-- ============================================================
-- 037 – Public web lead form
--
-- Opt-in flag per webhook. When enabled, a hosted lead form at /f/<id>
-- can post (without the secret) into the same ingestion pipeline
-- (dedup + round-robin + source + optional deal). Defaults OFF so an
-- existing secret webhook is never silently exposed to the public.
-- ============================================================

ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS public_form_enabled boolean NOT NULL DEFAULT false;
