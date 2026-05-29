-- ============================================================
-- 023 – Catalog, Deal Products Interest & Proposals
-- ============================================================

-- ── 1. Catalog items ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users ON DELETE SET NULL,
  name        text        NOT NULL,
  description text,
  price       numeric(12,2) NOT NULL DEFAULT 0,
  currency    text        NOT NULL DEFAULT 'USD',
  unit        text        NOT NULL DEFAULT 'unit',
  category    text,
  image_url   text,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_items_all" ON catalog_items
  USING (true)
  WITH CHECK (true);

-- ── 2. Deal ↔ Catalog interest (pre-proposal) ───────────────

CREATE TABLE IF NOT EXISTS deal_catalog_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid        NOT NULL REFERENCES deals ON DELETE CASCADE,
  catalog_item_id uuid        REFERENCES catalog_items ON DELETE SET NULL,
  name            text        NOT NULL,
  quantity        numeric(10,2) NOT NULL DEFAULT 1,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deal_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_catalog_items_all" ON deal_catalog_items
  USING (true)
  WITH CHECK (true);

-- ── 3. Proposals ────────────────────────────────────────────

CREATE TYPE proposal_status AS ENUM ('draft','sent','viewed','accepted','rejected');

CREATE TABLE IF NOT EXISTS proposals (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid            REFERENCES auth.users ON DELETE SET NULL,
  deal_id          uuid            REFERENCES deals ON DELETE SET NULL,
  contact_id       uuid            REFERENCES contacts ON DELETE SET NULL,
  proposal_number  text            UNIQUE NOT NULL,
  title            text            NOT NULL,
  status           proposal_status NOT NULL DEFAULT 'draft',
  valid_until      date,
  notes            text,
  terms            text,
  subtotal         numeric(12,2)   NOT NULL DEFAULT 0,
  discount_amount  numeric(12,2)   NOT NULL DEFAULT 0,
  tax_rate         numeric(5,2)    NOT NULL DEFAULT 0,
  total_amount     numeric(12,2)   NOT NULL DEFAULT 0,
  currency         text            NOT NULL DEFAULT 'USD',
  public_token     text            UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_by       uuid            REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at          timestamptz,
  sent_by          uuid            REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at        timestamptz,
  accepted_at      timestamptz,
  rejected_at      timestamptz,
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now()
);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_all" ON proposals
  USING (true)
  WITH CHECK (true);

-- ── 4. Proposal line items ───────────────────────────────────

CREATE TABLE IF NOT EXISTS proposal_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     uuid          NOT NULL REFERENCES proposals ON DELETE CASCADE,
  catalog_item_id uuid          REFERENCES catalog_items ON DELETE SET NULL,
  name            text          NOT NULL,
  description     text,
  quantity        numeric(10,2) NOT NULL DEFAULT 1,
  unit_price      numeric(12,2) NOT NULL DEFAULT 0,
  discount_pct    numeric(5,2)  NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  sort_order      int           NOT NULL DEFAULT 0
);

ALTER TABLE proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_items_all" ON proposal_items
  USING (true)
  WITH CHECK (true);

-- ── 5. Proposal send templates ───────────────────────────────

CREATE TABLE IF NOT EXISTS proposal_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users ON DELETE SET NULL,
  channel    text        NOT NULL CHECK (channel IN ('email','whatsapp')),
  name       text        NOT NULL,
  subject    text,
  body       text        NOT NULL,
  is_default boolean     NOT NULL DEFAULT false,
  created_by uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_templates_all" ON proposal_templates
  USING (true)
  WITH CHECK (true);

-- ── 6. Proposal history / audit trail ───────────────────────

CREATE TABLE IF NOT EXISTS proposal_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid        NOT NULL REFERENCES proposals ON DELETE CASCADE,
  action      text        NOT NULL,
  channel     text,
  actor_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  recipient   text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proposal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_history_all" ON proposal_history
  USING (true)
  WITH CHECK (true);

-- ── 7. Seed default proposal_templates ──────────────────────

INSERT INTO proposal_templates (channel, name, subject, body, is_default) VALUES
(
  'email',
  'Default Email Template',
  'Proposal: {{proposal_title}}',
  'Hi {{contact_name}},

Please find your proposal attached and also accessible via the link below.

📄 Proposal: {{proposal_title}}
💰 Total Amount: {{total_amount}}
📅 Valid Until: {{valid_until}}

View & Accept Proposal: {{proposal_link}}

Feel free to reach out if you have any questions.

Best regards',
  true
),
(
  'whatsapp',
  'Default WhatsApp Template',
  NULL,
  'Hi {{contact_name}}! 👋

We''ve prepared a proposal for you.

📄 *{{proposal_title}}*
💰 Total: {{total_amount}}
📅 Valid until: {{valid_until}}

View & accept here: {{proposal_link}}

Let us know if you have any questions!',
  true
);
