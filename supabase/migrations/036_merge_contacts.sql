-- ============================================================
-- 036 – Atomic contact merge
--
-- merge_contacts(survivor, loser): reassign everything that points at the
-- loser to the survivor, enrich the survivor's blank fields from the loser,
-- then delete the loser — all in one transaction. SECURITY DEFINER so it can
-- touch rows across RLS, with an internal role check (admin/owner/manager).
--
-- contact_tags & contact_custom_values have UNIQUE(contact_id, …) so we
-- delete the loser's colliding rows first, then reassign the rest.
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_contacts(p_survivor uuid, p_loser uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_survivor = p_loser THEN
    RAISE EXCEPTION 'Cannot merge a contact into itself';
  END IF;
  IF my_role() NOT IN ('admin', 'owner', 'manager') THEN
    RAISE EXCEPTION 'Not authorized to merge contacts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_survivor)
     OR NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_loser) THEN
    RAISE EXCEPTION 'Both contacts must exist';
  END IF;

  -- Tags — drop loser duplicates the survivor already has, reassign the rest.
  DELETE FROM contact_tags l
   WHERE l.contact_id = p_loser
     AND EXISTS (SELECT 1 FROM contact_tags s
                  WHERE s.contact_id = p_survivor AND s.tag_id = l.tag_id);
  UPDATE contact_tags SET contact_id = p_survivor WHERE contact_id = p_loser;

  -- Custom field values — same de-dupe by field.
  DELETE FROM contact_custom_values l
   WHERE l.contact_id = p_loser
     AND EXISTS (SELECT 1 FROM contact_custom_values s
                  WHERE s.contact_id = p_survivor AND s.custom_field_id = l.custom_field_id);
  UPDATE contact_custom_values SET contact_id = p_survivor WHERE contact_id = p_loser;

  -- Straight reassignments (no contact-scoped unique constraints).
  UPDATE deals                SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE conversations        SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE contact_notes        SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE followups            SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE email_logs           SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE email_notifications  SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE telephony_call_logs  SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE proposals            SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE broadcast_recipients SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE flow_runs            SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE automation_logs      SET contact_id = p_survivor WHERE contact_id = p_loser;
  UPDATE webhook_requests     SET created_contact_id = p_survivor WHERE created_contact_id = p_loser;

  -- Enrich the survivor: fill its blank fields from the loser; survivor wins
  -- on conflicting custom_data keys.
  UPDATE contacts s SET
    name        = COALESCE(NULLIF(s.name, ''), l.name),
    email       = COALESCE(NULLIF(s.email, ''), l.email),
    company     = COALESCE(NULLIF(s.company, ''), l.company),
    avatar_url  = COALESCE(s.avatar_url, l.avatar_url),
    source_id   = COALESCE(s.source_id, l.source_id),
    custom_data = COALESCE(l.custom_data, '{}'::jsonb) || COALESCE(s.custom_data, '{}'::jsonb),
    updated_at  = NOW()
  FROM contacts l
  WHERE s.id = p_survivor AND l.id = p_loser;

  DELETE FROM contacts WHERE id = p_loser;
END;
$$;

ALTER FUNCTION public.merge_contacts(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.merge_contacts(uuid, uuid) TO authenticated;
