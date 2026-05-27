-- Migration 016: Make user_id nullable on contacts and deals
--
-- user_id is a pure audit column. Migration 013 (roles_and_users) replaced
-- all `auth.uid() = user_id` RLS policies with role-based (my_role()) policies,
-- so this column has no access-control function and can safely be NULL.
--
-- Allowing NULL lets the webhook ingestion endpoint create contacts and deals
-- without a signed-in session — there is no human creator for webhook-ingested
-- records, so NULL is the semantically correct value.

ALTER TABLE contacts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE deals    ALTER COLUMN user_id DROP NOT NULL;
