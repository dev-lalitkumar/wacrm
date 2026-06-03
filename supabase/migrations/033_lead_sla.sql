-- ============================================================
-- 033 – Lead first-response SLA + untouched-lead escalation
--
-- Adds:
--   • first_response_at / sla_breached_at on deals, first_response_at on contacts
--   • sla_settings singleton (threshold + on/off)
--   • triggers that stamp first_response_at the moment a rep responds
--     (a logged follow-up, or an outbound WhatsApp message)
--   • notification templates for the new lead.sla_breached event
--
-- The cron (/api/notifications/cron) flags breaches and the notification
-- service escalates breach + overdue events to the rep AND their managers.
--
-- Reuses my_role() (013).
-- ============================================================

-- 1. SLA tracking columns
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached_at   TIMESTAMPTZ;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- Fast lookup for the cron breach sweep and the dashboard "untouched" card.
CREATE INDEX IF NOT EXISTS idx_deals_first_response
  ON deals (status, first_response_at, created_at)
  WHERE status = 'open';

-- 2. SLA settings (single row, id = 1)
CREATE TABLE IF NOT EXISTS sla_settings (
  id                     integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled                boolean     NOT NULL DEFAULT true,
  first_response_minutes integer     NOT NULL DEFAULT 15 CHECK (first_response_minutes > 0),
  updated_by             uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at             timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO sla_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sla_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_settings_read" ON sla_settings;
CREATE POLICY "sla_settings_read" ON sla_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "sla_settings_write" ON sla_settings;
CREATE POLICY "sla_settings_write" ON sla_settings
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));

-- 3. Stamp first response when a rep logs a follow-up.
CREATE OR REPLACE FUNCTION public.stamp_first_response_from_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    UPDATE deals
       SET first_response_at = NEW.created_at
     WHERE id = NEW.deal_id
       AND first_response_at IS NULL;
  END IF;
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
       SET first_response_at = NEW.created_at
     WHERE id = NEW.contact_id
       AND first_response_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_first_response_followup ON followups;
CREATE TRIGGER trg_first_response_followup
  AFTER INSERT ON followups
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_first_response_from_followup();

-- 4. Stamp first response when a rep sends an outbound WhatsApp message.
CREATE OR REPLACE FUNCTION public.stamp_first_response_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  IF NEW.sender_type <> 'agent' THEN
    RETURN NEW;
  END IF;

  SELECT contact_id INTO v_contact_id
    FROM conversations WHERE id = NEW.conversation_id;
  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE contacts
     SET first_response_at = NEW.created_at
   WHERE id = v_contact_id
     AND first_response_at IS NULL;

  UPDATE deals
     SET first_response_at = NEW.created_at
   WHERE contact_id = v_contact_id
     AND status = 'open'
     AND first_response_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_first_response_message ON messages;
CREATE TRIGGER trg_first_response_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_first_response_from_message();

-- 5. Notification templates for the new lead.sla_breached event.
--    Placeholders: {{entity_name}} {{minutes_waiting}} {{assignee_name}}
INSERT INTO notification_templates (event_type, channel, name, title, body) VALUES
('lead.sla_breached','in_app','Lead SLA Breached – In App',
  '⏰ Lead waiting for a first response',
  '{{entity_name}} has had no response for {{minutes_waiting}} min. Reach out now.'),
('lead.sla_breached','email','Lead SLA Breached – Email',
  'Lead needs a first response: {{entity_name}}',
  E'Hi {{assignee_name}},\n\nThis lead is still waiting for a first response:\n\nLead: {{entity_name}}\nWaiting: {{minutes_waiting}} minutes\n\nPlease reach out as soon as possible.'),
('lead.sla_breached','whatsapp','Lead SLA Breached – WhatsApp',
  '',
  E'⏰ Lead waiting for a first response\n\n👤 {{entity_name}}\n⌛ {{minutes_waiting}} min with no reply')
ON CONFLICT DO NOTHING;
