-- ═══════════════════════════════════════════════════════════
-- Show Me Italy Staff Calendar — Supabase Schema
-- Paste this entire file into Supabase SQL Editor and click Run
-- ═══════════════════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  pin_hash      TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin', 'manager', 'staff')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job Roles
CREATE TABLE IF NOT EXISTS job_roles (
  id              TEXT PRIMARY KEY,
  name            TEXT UNIQUE NOT NULL,
  color           TEXT NOT NULL,
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  shift_start     TEXT NOT NULL,
  shift_end       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff Role Assignments
CREATE TABLE IF NOT EXISTS staff_role_assignments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_role_id TEXT NOT NULL REFERENCES job_roles(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_role_id)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  user_display_name TEXT NOT NULL,
  user_role       TEXT NOT NULL,
  date            DATE NOT NULL,
  leave_type      TEXT NOT NULL CHECK (leave_type IN (
                    'regular_day_off', 'paid_vacation',
                    'auto_assigned', 'auto_sunday', 'special_day'
                  )),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending', 'approved', 'rejected', 'cancelled'
                  )),
  staff_note      TEXT DEFAULT '',
  approver_note   TEXT DEFAULT '',
  decided_by_id   TEXT,
  decided_by_name TEXT,
  decided_at      TIMESTAMPTZ,
  is_overridden   BOOLEAN NOT NULL DEFAULT FALSE,
  overridden_by_id   TEXT,
  overridden_by_name TEXT,
  overridden_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date, status)
);

-- Staffing Rules
CREATE TABLE IF NOT EXISTS staffing_rules (
  id                TEXT PRIMARY KEY,
  job_role_id       TEXT NOT NULL REFERENCES job_roles(id),
  day_of_week       INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  minimum_required  INTEGER NOT NULL DEFAULT 1,
  enforcement       TEXT NOT NULL DEFAULT 'warning_only' CHECK (
                      enforcement IN ('hard_block', 'warning_only')
                    ),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Holidays
CREATE TABLE IF NOT EXISTS holidays (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  date          DATE NOT NULL,
  is_recurring  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Special Days
CREATE TABLE IF NOT EXISTS special_days (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  date              DATE NOT NULL,
  consumes_balance  BOOLEAN NOT NULL DEFAULT FALSE,
  applies_to_all    BOOLEAN NOT NULL DEFAULT TRUE,
  applies_to        TEXT[] DEFAULT '{}',
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT NOT NULL,
  actor_name    TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  description   TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);

-- Notification Settings
CREATE TABLE IF NOT EXISTS notification_settings (
  id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_reminder_time     TEXT NOT NULL DEFAULT '14:00',
  daily_reminder_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              TEXT NOT NULL DEFAULT 'system'
);

-- Day Swaps
CREATE TABLE IF NOT EXISTS day_swaps (
  id                  TEXT PRIMARY KEY,
  proposer_id         TEXT NOT NULL REFERENCES users(id),
  proposer_name       TEXT NOT NULL,
  receiver_id         TEXT NOT NULL REFERENCES users(id),
  receiver_name       TEXT NOT NULL,
  date                DATE NOT NULL,
  original_request_id TEXT NOT NULL,
  common_job_role_id  TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════

-- Users (PINs are plaintext for demo — hash in production)
INSERT INTO users (id, username, display_name, pin_hash, role) VALUES
  ('usr_admin_001', 'admin', 'Nabeel Ahmed', '1111', 'super_admin'),
  ('usr_mgr_001', 'manager', 'Marco Rossi', '2222', 'manager'),
  ('usr_staff_001', 'staff1', 'Lucia Bianchi', '3333', 'staff'),
  ('usr_staff_002', 'staff2', 'Andrea Conti', '4444', 'staff'),
  ('usr_staff_003', 'staff3', 'Elena Marino', '5555', 'staff'),
  ('usr_staff_004', 'staff4', 'Giuseppe Ferrara', '6666', 'staff')
ON CONFLICT (id) DO NOTHING;

-- Job Roles
INSERT INTO job_roles (id, name, color, is_hidden, shift_start, shift_end) VALUES
  ('role_guide', 'Guide', '#138A52', FALSE, '08:00', '17:00'),
  ('role_checkin', 'Check-in', '#E6A800', TRUE, '07:30', '10:30'),
  ('role_coordinator', 'Coordinator', '#3B82F6', FALSE, '07:00', '16:00')
ON CONFLICT (id) DO NOTHING;

-- Staff Role Assignments
INSERT INTO staff_role_assignments (id, user_id, job_role_id, is_primary) VALUES
  ('assign_001', 'usr_staff_001', 'role_guide', TRUE),
  ('assign_002', 'usr_staff_001', 'role_checkin', FALSE),
  ('assign_003', 'usr_staff_002', 'role_guide', TRUE),
  ('assign_004', 'usr_staff_003', 'role_coordinator', TRUE),
  ('assign_005', 'usr_staff_004', 'role_guide', TRUE),
  ('assign_006', 'usr_staff_004', 'role_checkin', FALSE),
  ('assign_007', 'usr_mgr_001', 'role_coordinator', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Staffing Rules
INSERT INTO staffing_rules (id, job_role_id, day_of_week, minimum_required, enforcement) VALUES
  ('sr_001', 'role_guide', NULL, 2, 'warning_only'),
  ('sr_002', 'role_checkin', NULL, 1, 'hard_block'),
  ('sr_003', 'role_coordinator', NULL, 1, 'warning_only')
ON CONFLICT (id) DO NOTHING;

-- Italian Holidays 2026
INSERT INTO holidays (id, name, date, is_recurring) VALUES
  ('hol_001', 'New Year''s Day', '2026-01-01', TRUE),
  ('hol_002', 'Epiphany', '2026-01-06', TRUE),
  ('hol_003', 'Liberation Day', '2026-04-25', TRUE),
  ('hol_004', 'Labour Day', '2026-05-01', TRUE),
  ('hol_005', 'Republic Day', '2026-06-02', TRUE),
  ('hol_006', 'Ferragosto', '2026-08-15', TRUE),
  ('hol_007', 'All Saints'' Day', '2026-11-01', TRUE),
  ('hol_008', 'Immaculate Conception', '2026-12-08', TRUE),
  ('hol_009', 'Christmas Day', '2026-12-25', TRUE),
  ('hol_010', 'St. Stephen''s Day', '2026-12-26', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Special Days
INSERT INTO special_days (id, name, date, consumes_balance, applies_to_all, created_by) VALUES
  ('sp_001', 'Company Team Day', '2026-05-15', FALSE, TRUE, 'usr_admin_001'),
  ('sp_002', 'Mandatory Training', '2026-06-20', TRUE, TRUE, 'usr_admin_001')
ON CONFLICT (id) DO NOTHING;

-- Notification Settings
INSERT INTO notification_settings (id, daily_reminder_time, daily_reminder_enabled, updated_by) VALUES
  (1, '14:00', TRUE, 'usr_admin_001')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- DISABLE ROW LEVEL SECURITY FOR NOW (enable later with proper policies)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_swaps ENABLE ROW LEVEL SECURITY;

-- Allow anon key to read/write everything (for development)
-- In production, replace with proper role-based policies
CREATE POLICY "Allow all for anon" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON job_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON staff_role_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON staffing_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON holidays FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON special_days FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON notification_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON day_swaps FOR ALL USING (true) WITH CHECK (true);
