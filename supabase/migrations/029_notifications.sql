-- 029_notifications.sql — Unified notification system
--
-- Adds:
--   1. notifications        — in-app notification records (per profile)
--   2. notification_templates — user-editable templates per event × channel
--   3. reminder_notified_at columns on deals/contacts (cron double-fire guard)
--   4. Realtime publication for notifications
--   5. Seeded default templates (one per event × channel)
--
-- Events are dispatched server-side through src/lib/notifications/service.ts.
-- Channels (in_app / email / whatsapp) only fire when their integration is
-- configured and an active template exists for the event.

-- ════════════════════════════════════════════════════════
-- 1. notifications
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         text        NOT NULL,
  title        text        NOT NULL,
  body         text        NOT NULL DEFAULT '',
  entity_type  text,                              -- 'contact'|'deal'|'proposal'|'conversation'
  entity_id    uuid,
  metadata     jsonb       NOT NULL DEFAULT '{}',
  is_read      boolean     NOT NULL DEFAULT false,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON notifications (profile_id, created_at DESC)
  WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_profile_all
  ON notifications (profile_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see and mutate only their own notifications. Inserts come from the
-- service-role client (bypasses RLS), so no INSERT policy is needed.
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (profile_id = my_profile_id());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (profile_id = my_profile_id())
  WITH CHECK (profile_id = my_profile_id());

-- ════════════════════════════════════════════════════════
-- 2. notification_templates
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notification_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,   -- e.g. 'contact.assigned'
  channel     text        NOT NULL,   -- 'in_app' | 'email' | 'whatsapp'
  name        text        NOT NULL,
  title       text        NOT NULL DEFAULT '',  -- {{placeholder}} supported
  body        text        NOT NULL DEFAULT '',  -- {{placeholder}} supported
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_lookup
  ON notification_templates (event_type, channel, is_active);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (for preview); admins/owners manage.
DROP POLICY IF EXISTS "notif_templates_read" ON notification_templates;
CREATE POLICY "notif_templates_read" ON notification_templates
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "notif_templates_write" ON notification_templates;
CREATE POLICY "notif_templates_write" ON notification_templates
  FOR ALL USING (my_role() IN ('admin', 'owner'))
  WITH CHECK (my_role() IN ('admin', 'owner'));

-- ════════════════════════════════════════════════════════
-- 3. Reminder double-notify guard columns
-- ════════════════════════════════════════════════════════
ALTER TABLE deals    ADD COLUMN IF NOT EXISTS reminder_notified_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reminder_notified_at timestamptz;

-- ════════════════════════════════════════════════════════
-- 4. Realtime — filtered per profile_id in the client subscription
-- ════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════
-- 5. Seed default templates (one per event × channel)
-- ════════════════════════════════════════════════════════
INSERT INTO notification_templates (event_type, channel, name, title, body) VALUES

-- contact.assigned — placeholders: {{contact_name}} {{contact_phone}} {{assignee_name}} {{assigner_name}}
('contact.assigned','in_app','Contact Assigned – In App',
  'New contact assigned to you',
  '{{contact_name}} ({{contact_phone}}) was assigned to you by {{assigner_name}}.'),
('contact.assigned','email','Contact Assigned – Email',
  'New Contact Assigned: {{contact_name}}',
  E'Hi {{assignee_name}},\n\nA contact has been assigned to you:\n\nName: {{contact_name}}\nPhone: {{contact_phone}}\nAssigned by: {{assigner_name}}\n\nLog in to view the contact.'),
('contact.assigned','whatsapp','Contact Assigned – WhatsApp',
  '',
  E'🔔 New contact assigned to you\n\n👤 {{contact_name}}\n📞 {{contact_phone}}\nAssigned by: {{assigner_name}}'),

-- contact.created_from_meta — placeholders: {{contact_name}} {{contact_phone}} {{contact_email}}
('contact.created_from_meta','in_app','New Facebook Contact – In App',
  'New contact from Facebook Ads',
  '{{contact_name}} submitted a lead form. Phone: {{contact_phone}}.'),
('contact.created_from_meta','email','New Facebook Contact – Email',
  'New Facebook Contact: {{contact_name}}',
  E'A new contact came from Facebook Lead Ads:\n\nName: {{contact_name}}\nPhone: {{contact_phone}}\nEmail: {{contact_email}}\n\nLog in to review.'),
('contact.created_from_meta','whatsapp','New Facebook Contact – WhatsApp',
  '',
  E'📥 New Facebook contact\n\n👤 {{contact_name}}\n📞 {{contact_phone}}\n📧 {{contact_email}}'),

-- deal.created — placeholders: {{deal_title}} {{contact_name}} {{deal_value}} {{assignee_name}}
('deal.created','in_app','Deal Created – In App',
  'New deal assigned to you',
  '"{{deal_title}}" for {{contact_name}} was created and assigned to you.'),
('deal.created','email','Deal Created – Email',
  'New Deal: {{deal_title}}',
  E'Hi {{assignee_name}},\n\nA new deal has been created and assigned to you:\n\nDeal: {{deal_title}}\nContact: {{contact_name}}\nValue: {{deal_value}}\n\nLog in to manage it.'),
('deal.created','whatsapp','Deal Created – WhatsApp',
  '',
  E'💼 New deal assigned\n\n📋 {{deal_title}}\n👤 {{contact_name}}\n💰 {{deal_value}}'),

-- deal.assigned — placeholders: {{deal_title}} {{contact_name}} {{assignee_name}} {{assigner_name}}
('deal.assigned','in_app','Deal Assigned – In App',
  'Deal assigned to you',
  '"{{deal_title}}" for {{contact_name}} was assigned to you.'),
('deal.assigned','email','Deal Assigned – Email',
  'Deal Assigned: {{deal_title}}',
  E'Hi {{assignee_name}},\n\nThe deal "{{deal_title}}" ({{contact_name}}) has been assigned to you by {{assigner_name}}.'),
('deal.assigned','whatsapp','Deal Assigned – WhatsApp',
  '',
  E'💼 Deal assigned to you\n\n📋 {{deal_title}}\n👤 {{contact_name}}\nBy: {{assigner_name}}'),

-- deal.stage_changed — placeholders: {{deal_title}} {{contact_name}} {{stage_name}} {{assignee_name}}
('deal.stage_changed','in_app','Stage Changed – In App',
  'Deal moved to {{stage_name}}',
  '"{{deal_title}}" for {{contact_name}} is now in the {{stage_name}} stage.'),
('deal.stage_changed','email','Stage Changed – Email',
  'Deal Update: {{deal_title}}',
  E'Hi {{assignee_name}},\n\nYour deal "{{deal_title}}" has moved to the {{stage_name}} stage.\nContact: {{contact_name}}'),
('deal.stage_changed','whatsapp','Stage Changed – WhatsApp',
  '',
  E'📊 Deal stage updated\n\n📋 {{deal_title}}\n🏷️ Stage: {{stage_name}}\n👤 {{contact_name}}'),

-- deal.closed_won — placeholders: {{deal_title}} {{contact_name}} {{deal_value}} {{assignee_name}}
('deal.closed_won','in_app','Deal Won – In App',
  '🎉 Deal won!',
  '"{{deal_title}}" for {{contact_name}} was marked as won. Value: {{deal_value}}.'),
('deal.closed_won','email','Deal Won – Email',
  '🎉 Deal Won: {{deal_title}}',
  E'Congratulations {{assignee_name}}!\n\n"{{deal_title}}" for {{contact_name}} has been marked as Won.\nValue: {{deal_value}}'),
('deal.closed_won','whatsapp','Deal Won – WhatsApp',
  '',
  E'🎉 Deal won!\n\n📋 {{deal_title}}\n👤 {{contact_name}}\n💰 {{deal_value}}'),

-- deal.closed_lost — placeholders: {{deal_title}} {{contact_name}} {{assignee_name}}
('deal.closed_lost','in_app','Deal Lost – In App',
  'Deal lost',
  '"{{deal_title}}" for {{contact_name}} was marked as lost.'),
('deal.closed_lost','email','Deal Lost – Email',
  'Deal Lost: {{deal_title}}',
  E'Hi {{assignee_name}},\n\n"{{deal_title}}" for {{contact_name}} has been marked as Lost.'),
('deal.closed_lost','whatsapp','Deal Lost – WhatsApp',
  '',
  E'❌ Deal lost\n\n📋 {{deal_title}}\n👤 {{contact_name}}'),

-- reminder.due_today — placeholders: {{entity_name}} {{reminder_type}} {{reminder_note}} {{assignee_name}}
('reminder.due_today','in_app','Reminder Due Today – In App',
  'Reminder due today',
  '{{reminder_type}} for {{entity_name}}: {{reminder_note}}'),
('reminder.due_today','email','Reminder Due Today – Email',
  'Reminder Due Today: {{entity_name}}',
  E'Hi {{assignee_name}},\n\nYou have a {{reminder_type}} reminder due today:\n\n{{entity_name}}\nNote: {{reminder_note}}'),
('reminder.due_today','whatsapp','Reminder Due Today – WhatsApp',
  '',
  E'⏰ Reminder due today\n\n🔔 {{reminder_type}}: {{entity_name}}\n📝 {{reminder_note}}'),

-- reminder.overdue — placeholders: {{entity_name}} {{reminder_type}} {{reminder_note}} {{days_overdue}} {{assignee_name}}
('reminder.overdue','in_app','Overdue Reminder – In App',
  'Overdue reminder',
  '{{reminder_type}} for {{entity_name}} was due {{days_overdue}} day(s) ago. Note: {{reminder_note}}'),
('reminder.overdue','email','Overdue Reminder – Email',
  'Overdue Reminder: {{entity_name}}',
  E'Hi {{assignee_name}},\n\nYou have an overdue reminder:\n\n{{entity_name}}\nType: {{reminder_type}}\nNote: {{reminder_note}}\nDue: {{days_overdue}} day(s) ago'),
('reminder.overdue','whatsapp','Overdue Reminder – WhatsApp',
  '',
  E'⚠️ Overdue reminder\n\n🔔 {{reminder_type}}: {{entity_name}}\n📝 {{reminder_note}}\n⏰ {{days_overdue}} day(s) overdue'),

-- proposal.viewed — placeholders: {{proposal_title}} {{contact_name}} {{proposal_value}}
('proposal.viewed','in_app','Proposal Viewed – In App',
  'Proposal viewed by client',
  '"{{proposal_title}}" was opened by the client.'),
('proposal.viewed','email','Proposal Viewed – Email',
  'Proposal Opened: {{proposal_title}}',
  E'Your proposal "{{proposal_title}}" for {{contact_name}} has been viewed by the client.'),
('proposal.viewed','whatsapp','Proposal Viewed – WhatsApp',
  '',
  E'👁️ Proposal viewed\n\n📄 {{proposal_title}}\n👤 {{contact_name}}'),

-- proposal.accepted — placeholders: {{proposal_title}} {{contact_name}} {{proposal_value}}
('proposal.accepted','in_app','Proposal Accepted – In App',
  '✅ Proposal accepted',
  '"{{proposal_title}}" was accepted by {{contact_name}}. Value: {{proposal_value}}.'),
('proposal.accepted','email','Proposal Accepted – Email',
  '✅ Proposal Accepted: {{proposal_title}}',
  E'Great news!\n\n"{{proposal_title}}" was accepted by {{contact_name}}.\nValue: {{proposal_value}}'),
('proposal.accepted','whatsapp','Proposal Accepted – WhatsApp',
  '',
  E'✅ Proposal accepted!\n\n📄 {{proposal_title}}\n👤 {{contact_name}}\n💰 {{proposal_value}}'),

-- proposal.rejected — placeholders: {{proposal_title}} {{contact_name}}
('proposal.rejected','in_app','Proposal Rejected – In App',
  'Proposal rejected',
  '"{{proposal_title}}" was rejected by {{contact_name}}.'),
('proposal.rejected','email','Proposal Rejected – Email',
  'Proposal Rejected: {{proposal_title}}',
  E'"{{proposal_title}}" for {{contact_name}} has been rejected.'),
('proposal.rejected','whatsapp','Proposal Rejected – WhatsApp',
  '',
  E'❌ Proposal rejected\n\n📄 {{proposal_title}}\n👤 {{contact_name}}'),

-- conversation.assigned — placeholders: {{contact_name}} {{contact_phone}} {{agent_name}}
('conversation.assigned','in_app','Conversation Assigned – In App',
  'Conversation assigned to you',
  'A conversation with {{contact_name}} ({{contact_phone}}) has been assigned to you.'),
('conversation.assigned','email','Conversation Assigned – Email',
  'Conversation Assigned: {{contact_name}}',
  E'Hi {{agent_name}},\n\nA WhatsApp conversation with {{contact_name}} ({{contact_phone}}) has been assigned to you.'),
('conversation.assigned','whatsapp','Conversation Assigned – WhatsApp',
  '',
  E'💬 Conversation assigned\n\n👤 {{contact_name}}\n📞 {{contact_phone}}')

ON CONFLICT DO NOTHING;
