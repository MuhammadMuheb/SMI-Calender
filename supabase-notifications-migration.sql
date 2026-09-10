-- ═══════════════════════════════════════════════════════════
-- NOTIFICATIONS TABLE — Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_status  TEXT NOT NULL DEFAULT 'pending' CHECK (confirm_status IN ('pending', 'confirmed', 'rejected')),
  reject_reason   TEXT DEFAULT '',
  entity_type     TEXT,
  entity_id       TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON notifications FOR ALL USING (true) WITH CHECK (true);
