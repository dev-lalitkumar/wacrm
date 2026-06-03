-- ============================================================
-- 039 – note.mention notification templates
--
-- Fired when a teammate is @mentioned on a contact note, so they get pulled
-- into the conversation. Placeholders: {{contact_name}} {{mentioner_name}}
-- {{note_excerpt}}. In-app + email seeded (no WhatsApp — it's internal).
-- ============================================================

INSERT INTO notification_templates (event_type, channel, name, title, body) VALUES
('note.mention','in_app','Mentioned in a Note – In App',
  '{{mentioner_name}} mentioned you',
  'On {{contact_name}}: "{{note_excerpt}}"'),
('note.mention','email','Mentioned in a Note – Email',
  '{{mentioner_name}} mentioned you on {{contact_name}}',
  E'{{mentioner_name}} mentioned you in a note on {{contact_name}}:\n\n"{{note_excerpt}}"\n\nLog in to reply.')
ON CONFLICT DO NOTHING;
