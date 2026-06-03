-- ============================================================
-- 035 – Follow-up outcome / disposition
--
-- Records the *result* of a logged follow-up (not just that it happened),
-- so activity reports can show connect rates, callbacks, etc. Optional —
-- existing rows and quick notes can leave it NULL.
-- ============================================================

ALTER TABLE followups
  ADD COLUMN IF NOT EXISTS outcome text
    CHECK (outcome IS NULL OR outcome IN (
      'connected',
      'no_answer',
      'left_message',
      'callback',
      'interested',
      'not_interested',
      'wrong_number'
    ));

CREATE INDEX IF NOT EXISTS idx_followups_outcome ON followups (outcome) WHERE outcome IS NOT NULL;
