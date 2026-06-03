-- ============================================================
-- 031 — Deal history, Gmail profile fields, notification rework
--
-- Combines three related changes:
--   1. deal_history table + trigger — records every stage/status
--      change on a deal, surfaced in the deal History timeline.
--   2. gmail_config — add connected_name / connected_picture so the
--      settings UI can show the connected Google account's identity.
--   3. Notifications — drop the channel-specific "New contact from
--      Facebook" event and seed two customer-facing templates:
--      contact.welcome (any new contact) and contact.welcome_back
--      (repeat deal). Both go to the contact via email + WhatsApp only.
-- ============================================================

-- ════════════════════════════════════════════════════════
-- 1. Deal history
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS deal_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field       text        NOT NULL,            -- 'stage' | 'status'
  old_value   text,
  new_value   text,
  changed_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_history_deal
  ON deal_history (deal_id, created_at DESC);

ALTER TABLE deal_history ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (same pattern as email_logs). Rows are
-- inserted only by the SECURITY DEFINER trigger below, so no INSERT policy.
DROP POLICY IF EXISTS "deal_history_read" ON deal_history;
CREATE POLICY "deal_history_read" ON deal_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Trigger: record stage/status transitions. Resolves stage names so the
-- timeline stays readable even if a stage is later renamed. changed_by is
-- my_profile_id() — NULL for service-role writes (shown as "System").
CREATE OR REPLACE FUNCTION public.record_deal_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor      uuid := my_profile_id();
  old_stage  text;
  new_stage  text;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO old_stage FROM pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_stage FROM pipeline_stages WHERE id = NEW.stage_id;
    INSERT INTO deal_history (deal_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'stage', old_stage, new_stage, actor);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO deal_history (deal_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, actor);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_deal_history ON deals;
CREATE TRIGGER trg_record_deal_history
  AFTER UPDATE OF stage_id, status ON deals
  FOR EACH ROW
  EXECUTE FUNCTION public.record_deal_history();

-- ════════════════════════════════════════════════════════
-- 2. Gmail connected account identity
-- ════════════════════════════════════════════════════════
ALTER TABLE gmail_config ADD COLUMN IF NOT EXISTS connected_name    text;
ALTER TABLE gmail_config ADD COLUMN IF NOT EXISTS connected_picture text;

-- ════════════════════════════════════════════════════════
-- 3. Notification rework — unified welcome / welcome-back
-- ════════════════════════════════════════════════════════

-- Remove the old channel-specific Facebook contact notification.
DELETE FROM notification_templates WHERE event_type = 'contact.created_from_meta';

-- Seed the two customer-facing welcome templates. These are sent TO THE
-- CONTACT, so only email + whatsapp channels exist (no in_app).
INSERT INTO notification_templates (event_type, channel, name, title, body) VALUES

-- contact.welcome — placeholders: {{contact_name}} {{contact_phone}} {{contact_email}} {{company}}
('contact.welcome','email','Welcome Message For Contact – Email',
  'Welcome, {{contact_name}}!',
  E'Hi {{contact_name}},\n\nThank you for getting in touch — we''re glad to have you with us. A member of our team will reach out shortly.\n\nBest regards'),
('contact.welcome','whatsapp','Welcome Message For Contact – WhatsApp',
  '',
  E'Hi {{contact_name}} 👋\n\nThanks for reaching out! We''ve received your details and our team will be in touch shortly.'),

-- contact.welcome_back — placeholders: {{contact_name}} {{deal_title}} {{deal_value}}
('contact.welcome_back','email','Welcome Back Message For Contact – Email',
  'Great to hear from you again, {{contact_name}}!',
  E'Hi {{contact_name}},\n\nWelcome back! We''re excited to work with you again on "{{deal_title}}". Our team will follow up with you soon.\n\nBest regards'),
('contact.welcome_back','whatsapp','Welcome Back Message For Contact – WhatsApp',
  '',
  E'Welcome back {{contact_name}}! 🎉\n\nGreat to hear from you again about "{{deal_title}}". We''ll be in touch shortly.')

ON CONFLICT DO NOTHING;
