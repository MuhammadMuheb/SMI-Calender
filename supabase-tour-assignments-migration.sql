-- ═══════════════════════════════════════════════════════════
-- Tour Assignments — tracks which staff/guide is scheduled to
-- work a tour on a given date (imported from the printed monthly
-- schedules). Paste into Supabase SQL Editor and click Run.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tour_assignments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual', -- e.g. 'manual', 'import:2026-08', 'import:2026-09'
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tour_assignments_date ON tour_assignments(date);
CREATE INDEX IF NOT EXISTS idx_tour_assignments_user ON tour_assignments(user_id);

ALTER TABLE tour_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON tour_assignments FOR ALL USING (true) WITH CHECK (true);
