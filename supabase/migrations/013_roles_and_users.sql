-- ============================================================
-- 013_roles_and_users.sql — Multi-User & Roles (single-org)
--
-- Adds four roles (admin, owner, manager, executive), bootstraps
-- the first signup as admin, and locks subsequent public signup at
-- the trigger level. RLS is rewritten across all tables to gate by
-- role + assignment instead of `user_id = auth.uid()`. The
-- `user_id` columns survive as audit / created_by fields.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. profiles — role enum, status flags, created_by
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Default new rows to 'executive' going forward. handle_new_user
-- overrides this for the bootstrap admin and for admin-created users.
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'executive';

-- Promote any pre-existing single user to admin (covers the 001
-- legacy default of 'user'). Any unknown role is normalised to
-- 'admin' so the CHECK below doesn't refuse to apply.
UPDATE profiles
  SET role = 'admin'
  WHERE role IS NULL
     OR role NOT IN ('admin','owner','manager','executive');

-- Idempotent constraint add.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','owner','manager','executive'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active);

-- ============================================================
-- 2. contacts.assigned_to — Executive scoping column
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS assigned_to UUID
  REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);

-- ============================================================
-- 3. Helper SQL functions
--
-- SECURITY DEFINER so the lookups bypass the profiles RLS that we
-- redefine below. STABLE so Postgres can memoise calls inside a
-- single statement (every row-level check in a SELECT re-uses the
-- same value).
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
    FROM profiles
   WHERE user_id = auth.uid()
     AND is_active = TRUE
   LIMIT 1;
$$;

ALTER FUNCTION public.my_role() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
    FROM profiles
   WHERE user_id = auth.uid()
     AND is_active = TRUE
   LIMIT 1;
$$;

ALTER FUNCTION public.my_profile_id() OWNER TO postgres;

-- ============================================================
-- 4. Replace handle_new_user — bootstrap first admin + lockdown
--
-- First-ever signup (when profiles is empty) becomes admin, with
-- no forced password change.  Every subsequent signup MUST carry
-- a `created_by` UUID in user_metadata, which only our service-role
-- /api/users route sets. Without it the function raises, which
-- aborts the auth.users insert and rolls back the signup.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_role TEXT;
  v_must_change BOOLEAN;
  v_created_by UUID;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.profiles;

  IF v_count = 0 THEN
    v_role := 'admin';
    v_must_change := FALSE;
    v_created_by := NULL;
  ELSE
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'executive');
    v_must_change := COALESCE(
      (NEW.raw_user_meta_data->>'must_change_password')::BOOLEAN,
      TRUE
    );
    v_created_by := NULLIF(NEW.raw_user_meta_data->>'created_by','')::UUID;

    IF v_created_by IS NULL THEN
      RAISE EXCEPTION
        'Public registration is disabled. Contact your administrator.';
    END IF;

    IF v_role NOT IN ('admin','owner','manager','executive') THEN
      RAISE EXCEPTION 'Invalid role: %', v_role;
    END IF;
  END IF;

  INSERT INTO public.profiles
    (user_id, full_name, email, role, is_active,
     must_change_password, created_by)
  VALUES
    (NEW.id,
     COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
     NEW.email,
     v_role,
     TRUE,
     v_must_change,
     v_created_by);

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. RLS rewrite
--
-- Drop every per-user policy created in 001 / 006 / 009 / 010 and
-- replace with role-gated equivalents. Reads are workspace-wide
-- except where Executive must be restricted to assignments.
-- ============================================================

-- ---- profiles ----------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Members view own workspace profiles" ON profiles;
DROP POLICY IF EXISTS "Members update own profile" ON profiles;
DROP POLICY IF EXISTS "Members read profiles" ON profiles;

CREATE POLICY "Members read profiles" ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Members update own profile" ON profiles FOR UPDATE
  USING (user_id = auth.uid());
-- INSERT / DELETE intentionally omitted — created exclusively by
-- the handle_new_user trigger; admin API uses service-role.

-- ---- contacts ----------------------------------------------
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts read" ON contacts;
DROP POLICY IF EXISTS "contacts insert" ON contacts;
DROP POLICY IF EXISTS "contacts update" ON contacts;
DROP POLICY IF EXISTS "contacts delete" ON contacts;

CREATE POLICY "contacts read" ON contacts FOR SELECT
  USING (
    my_role() IN ('admin','owner','manager')
    OR assigned_to = my_profile_id()
  );
CREATE POLICY "contacts insert" ON contacts FOR INSERT
  WITH CHECK (my_role() IS NOT NULL);
CREATE POLICY "contacts update" ON contacts FOR UPDATE
  USING (
    my_role() IN ('admin','owner','manager')
    OR assigned_to = my_profile_id()
  );
CREATE POLICY "contacts delete" ON contacts FOR DELETE
  USING (my_role() IN ('admin','owner','manager'));

-- ---- tags --------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
DROP POLICY IF EXISTS "tags read" ON tags;
DROP POLICY IF EXISTS "tags write" ON tags;

CREATE POLICY "tags read" ON tags FOR SELECT
  USING (my_role() IS NOT NULL);
CREATE POLICY "tags write" ON tags FOR ALL
  USING (my_role() IN ('admin','owner','manager'))
  WITH CHECK (my_role() IN ('admin','owner','manager'));

-- ---- contact_tags ------------------------------------------
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
DROP POLICY IF EXISTS "contact_tags read" ON contact_tags;
DROP POLICY IF EXISTS "contact_tags write" ON contact_tags;

CREATE POLICY "contact_tags read" ON contact_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );
CREATE POLICY "contact_tags write" ON contact_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );

-- ---- custom_fields -----------------------------------------
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
DROP POLICY IF EXISTS "custom_fields read" ON custom_fields;
DROP POLICY IF EXISTS "custom_fields write" ON custom_fields;

CREATE POLICY "custom_fields read" ON custom_fields FOR SELECT
  USING (my_role() IS NOT NULL);
CREATE POLICY "custom_fields write" ON custom_fields FOR ALL
  USING (my_role() IN ('admin','owner','manager'))
  WITH CHECK (my_role() IN ('admin','owner','manager'));

-- ---- contact_custom_values ---------------------------------
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
DROP POLICY IF EXISTS "contact_custom_values read" ON contact_custom_values;
DROP POLICY IF EXISTS "contact_custom_values write" ON contact_custom_values;

CREATE POLICY "contact_custom_values read" ON contact_custom_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );
CREATE POLICY "contact_custom_values write" ON contact_custom_values FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );

-- ---- contact_notes -----------------------------------------
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
DROP POLICY IF EXISTS "contact_notes read" ON contact_notes;
DROP POLICY IF EXISTS "contact_notes write" ON contact_notes;

CREATE POLICY "contact_notes read" ON contact_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_notes.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );
CREATE POLICY "contact_notes write" ON contact_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_notes.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_notes.contact_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_to = my_profile_id()
        )
    )
  );

-- ---- conversations -----------------------------------------
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
DROP POLICY IF EXISTS "conversations read" ON conversations;
DROP POLICY IF EXISTS "conversations write" ON conversations;

CREATE POLICY "conversations read" ON conversations FOR SELECT
  USING (
    my_role() IN ('admin','owner','manager')
    OR assigned_agent_id = auth.uid()
  );
CREATE POLICY "conversations write" ON conversations FOR ALL
  USING (my_role() IS NOT NULL)
  WITH CHECK (my_role() IS NOT NULL);

-- ---- messages ----------------------------------------------
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON messages;
DROP POLICY IF EXISTS "messages read" ON messages;
DROP POLICY IF EXISTS "messages write" ON messages;

CREATE POLICY "messages read" ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_agent_id = auth.uid()
        )
    )
  );
CREATE POLICY "messages write" ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_agent_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_agent_id = auth.uid()
        )
    )
  );

-- ---- message_reactions -------------------------------------
DROP POLICY IF EXISTS "Users see reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users insert reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users delete their own agent reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users update their own agent reactions" ON message_reactions;
DROP POLICY IF EXISTS "reactions read" ON message_reactions;
DROP POLICY IF EXISTS "reactions insert" ON message_reactions;
DROP POLICY IF EXISTS "reactions update" ON message_reactions;
DROP POLICY IF EXISTS "reactions delete" ON message_reactions;

CREATE POLICY "reactions read" ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_agent_id = auth.uid()
        )
    )
  );
CREATE POLICY "reactions insert" ON message_reactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND (
          my_role() IN ('admin','owner','manager')
          OR c.assigned_agent_id = auth.uid()
        )
    )
  );
CREATE POLICY "reactions update" ON message_reactions FOR UPDATE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
  );
CREATE POLICY "reactions delete" ON message_reactions FOR DELETE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
  );

-- ---- whatsapp_config (admin/owner write only) --------------
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config read" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config write" ON whatsapp_config;

CREATE POLICY "whatsapp_config read" ON whatsapp_config FOR SELECT
  USING (my_role() IS NOT NULL);
CREATE POLICY "whatsapp_config write" ON whatsapp_config FOR ALL
  USING (my_role() IN ('admin','owner'))
  WITH CHECK (my_role() IN ('admin','owner'));

-- ---- message_templates (manager+ only) ---------------------
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
DROP POLICY IF EXISTS "message_templates read" ON message_templates;
DROP POLICY IF EXISTS "message_templates write" ON message_templates;

CREATE POLICY "message_templates read" ON message_templates FOR SELECT
  USING (my_role() IN ('admin','owner','manager'));
CREATE POLICY "message_templates write" ON message_templates FOR ALL
  USING (my_role() IN ('admin','owner','manager'))
  WITH CHECK (my_role() IN ('admin','owner','manager'));

-- ---- pipelines (admin/owner write) -------------------------
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
DROP POLICY IF EXISTS "pipelines read" ON pipelines;
DROP POLICY IF EXISTS "pipelines write" ON pipelines;

CREATE POLICY "pipelines read" ON pipelines FOR SELECT
  USING (my_role() IS NOT NULL);
CREATE POLICY "pipelines write" ON pipelines FOR ALL
  USING (my_role() IN ('admin','owner'))
  WITH CHECK (my_role() IN ('admin','owner'));

-- ---- pipeline_stages (admin/owner write) -------------------
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages read" ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages write" ON pipeline_stages;

CREATE POLICY "pipeline_stages read" ON pipeline_stages FOR SELECT
  USING (my_role() IS NOT NULL);
CREATE POLICY "pipeline_stages write" ON pipeline_stages FOR ALL
  USING (my_role() IN ('admin','owner'))
  WITH CHECK (my_role() IN ('admin','owner'));

-- ---- deals -------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
DROP POLICY IF EXISTS "deals read" ON deals;
DROP POLICY IF EXISTS "deals write" ON deals;

CREATE POLICY "deals read" ON deals FOR SELECT
  USING (
    my_role() IN ('admin','owner','manager')
    OR assigned_to = my_profile_id()
  );
CREATE POLICY "deals write" ON deals FOR ALL
  USING (my_role() IS NOT NULL)
  WITH CHECK (my_role() IS NOT NULL);

-- ---- broadcasts (manager+ only) ----------------------------
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "broadcasts read" ON broadcasts;
DROP POLICY IF EXISTS "broadcasts write" ON broadcasts;

CREATE POLICY "broadcasts read" ON broadcasts FOR SELECT
  USING (my_role() IN ('admin','owner','manager'));
CREATE POLICY "broadcasts write" ON broadcasts FOR ALL
  USING (my_role() IN ('admin','owner','manager'))
  WITH CHECK (my_role() IN ('admin','owner','manager'));

-- ---- broadcast_recipients (manager+ only) ------------------
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
DROP POLICY IF EXISTS "broadcast_recipients read" ON broadcast_recipients;
DROP POLICY IF EXISTS "broadcast_recipients write" ON broadcast_recipients;

CREATE POLICY "broadcast_recipients read" ON broadcast_recipients FOR SELECT
  USING (my_role() IN ('admin','owner','manager'));
CREATE POLICY "broadcast_recipients write" ON broadcast_recipients FOR ALL
  USING (my_role() IN ('admin','owner','manager'))
  WITH CHECK (my_role() IN ('admin','owner','manager'));

-- ---- automations (admin/owner only) ------------------------
DROP POLICY IF EXISTS "Users can manage own automations" ON automations;
DROP POLICY IF EXISTS "automations read" ON automations;
DROP POLICY IF EXISTS "automations write" ON automations;

CREATE POLICY "automations read" ON automations FOR SELECT
  USING (my_role() IN ('admin','owner'));
CREATE POLICY "automations write" ON automations FOR ALL
  USING (my_role() IN ('admin','owner'))
  WITH CHECK (my_role() IN ('admin','owner'));

-- ---- automation_steps (admin/owner only) -------------------
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
DROP POLICY IF EXISTS "automation_steps read" ON automation_steps;
DROP POLICY IF EXISTS "automation_steps write" ON automation_steps;

CREATE POLICY "automation_steps read" ON automation_steps FOR SELECT
  USING (my_role() IN ('admin','owner'));
CREATE POLICY "automation_steps write" ON automation_steps FOR ALL
  USING (my_role() IN ('admin','owner'))
  WITH CHECK (my_role() IN ('admin','owner'));

-- ---- automation_logs (admin/owner only) --------------------
DROP POLICY IF EXISTS "Users can view own automation logs" ON automation_logs;
DROP POLICY IF EXISTS "automation_logs read" ON automation_logs;

CREATE POLICY "automation_logs read" ON automation_logs FOR SELECT
  USING (my_role() IN ('admin','owner'));

-- ---- flows / flow_nodes / flow_runs / flow_run_events ------
DROP POLICY IF EXISTS "Users can manage own flows" ON flows;
DROP POLICY IF EXISTS "flows read" ON flows;
DROP POLICY IF EXISTS "flows write" ON flows;

CREATE POLICY "flows read" ON flows FOR SELECT
  USING (my_role() IN ('admin','owner'));
CREATE POLICY "flows write" ON flows FOR ALL
  USING (my_role() IN ('admin','owner'))
  WITH CHECK (my_role() IN ('admin','owner'));

DROP POLICY IF EXISTS "Users manage nodes on their flows" ON flow_nodes;
DROP POLICY IF EXISTS "flow_nodes read" ON flow_nodes;
DROP POLICY IF EXISTS "flow_nodes write" ON flow_nodes;

CREATE POLICY "flow_nodes read" ON flow_nodes FOR SELECT
  USING (my_role() IN ('admin','owner'));
CREATE POLICY "flow_nodes write" ON flow_nodes FOR ALL
  USING (my_role() IN ('admin','owner'))
  WITH CHECK (my_role() IN ('admin','owner'));

DROP POLICY IF EXISTS "Users see own flow runs" ON flow_runs;
DROP POLICY IF EXISTS "flow_runs read" ON flow_runs;

CREATE POLICY "flow_runs read" ON flow_runs FOR SELECT
  USING (my_role() IN ('admin','owner'));

DROP POLICY IF EXISTS "Users see events on their runs" ON flow_run_events;
DROP POLICY IF EXISTS "flow_run_events read" ON flow_run_events;

CREATE POLICY "flow_run_events read" ON flow_run_events FOR SELECT
  USING (my_role() IN ('admin','owner'));
