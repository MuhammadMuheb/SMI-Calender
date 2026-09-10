-- ═══════════════════════════════════════════════════════════
-- Show Me Italy Staff Calendar — Database Schema
-- STATUS: REFERENCE ONLY — not connected to any database yet
-- This schema documents the intended production data model.
-- ═══════════════════════════════════════════════════════════

-- Users
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  pin_hash      TEXT NOT NULL,       -- bcrypt hash in production
 role          TEXT NOT NULL CHECK (role IN ('super_admin', 'manager', 'staff', 'spectator')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Job Roles (Guide, Check-in, Coordinator, etc.)
CREATE TABLE job_roles (
  id              TEXT PRIMARY KEY,
  name            TEXT UNIQUE NOT NULL,
  color           TEXT NOT NULL,        -- hex color
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  shift_start     TIME NOT NULL,
  shift_end       TIME NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Staff ↔ Job Role assignments (many-to-many)
CREATE TABLE staff_role_assignments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_role_id TEXT NOT NULL REFERENCES job_roles(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_role_id)
);

-- Leave Requests
CREATE TABLE leave_requests (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
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
  decided_by      TEXT REFERENCES users(id),
  decided_at      TIMESTAMP,
  is_overridden   BOOLEAN NOT NULL DEFAULT FALSE,
  overridden_by   TEXT REFERENCES users(id),
  overridden_at   TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)  -- one request per user per day
);

-- Leave Balances (per user per 4-week cycle)
CREATE TABLE leave_balances (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id),
  cycle_start           DATE NOT NULL,
  cycle_end             DATE NOT NULL,
  regular_days_allowed  INTEGER NOT NULL DEFAULT 6,
  regular_days_used     INTEGER NOT NULL DEFAULT 0,
  vacation_days_total   INTEGER NOT NULL DEFAULT 0,
  vacation_days_used    INTEGER NOT NULL DEFAULT 0,
  auto_sunday_consumed  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cycle_start)
);

-- Balance Adjustments (audit trail for manual changes)
CREATE TABLE balance_adjustments (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  adjusted_by     TEXT NOT NULL REFERENCES users(id),
  field           TEXT NOT NULL,
  previous_value  INTEGER NOT NULL,
  new_value       INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Staffing Rules (minimum coverage per role per day)
CREATE TABLE staffing_rules (
  id                TEXT PRIMARY KEY,
  job_role_id       TEXT NOT NULL REFERENCES job_roles(id),
  day_of_week       INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- NULL = all days
  minimum_required  INTEGER NOT NULL DEFAULT 1,
  enforcement       TEXT NOT NULL DEFAULT 'warning_only' CHECK (
                      enforcement IN ('hard_block', 'warning_only')
                    ),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Holidays
CREATE TABLE holidays (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  date          DATE NOT NULL,
  is_recurring  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Special Days
CREATE TABLE special_days (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  date              DATE NOT NULL,
  consumes_balance  BOOLEAN NOT NULL DEFAULT FALSE,
  applies_to_all    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        TEXT NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Special Day ↔ User assignments (when applies_to_all = false)
CREATE TABLE special_day_users (
  special_day_id  TEXT NOT NULL REFERENCES special_days(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (special_day_id, user_id)
);

-- Audit Log
CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT NOT NULL REFERENCES users(id),
  actor_name    TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  description   TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  timestamp     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

-- Notifications
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  entity_type TEXT,
  entity_id   TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- Notification Settings (single row)
CREATE TABLE notification_settings (
  id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_reminder_time     TIME NOT NULL DEFAULT '14:00',
  daily_reminder_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by              TEXT NOT NULL REFERENCES users(id)
);
