-- ═══════════════════════════════════════════════════════════
-- Show Me Italy Staff Calendar — Security Migration, Part 2
--
-- DO NOT run this until, in order:
--   1. supabase-security-migration-part1.sql has been run.
--   2. scripts/migrate-users-to-auth.mjs has been run and every real user
--      has an auth_user_id set.
--   3. The updated app code (Supabase-Auth-based login) is deployed and you
--      have personally confirmed at least one real login works end to end.
--
-- Running this before that will lock everyone out — the old anon-key access
-- these policies remove is exactly what the *old* login flow depended on.
--
-- What this does: replaces every "Allow all for anon" policy (readable and
-- writable by literally anyone holding the public anon key, logged in or
-- not) with policies that require a real authenticated session, scoped to
-- the same staff/manager/super_admin capability table already enforced in
-- the UI — so it's enforced here too, not just cosmetically in the app.
-- ═══════════════════════════════════════════════════════════

-- These four tables were never in the original schema.sql RLS block, so make
-- sure RLS is actually on before adding policies to them.
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Drop every old blanket policy (only the first 10 tables ever had one).
DROP POLICY IF EXISTS "Allow all for anon" ON users;
DROP POLICY IF EXISTS "Allow all for anon" ON job_roles;
DROP POLICY IF EXISTS "Allow all for anon" ON staff_role_assignments;
DROP POLICY IF EXISTS "Allow all for anon" ON leave_requests;
DROP POLICY IF EXISTS "Allow all for anon" ON staffing_rules;
DROP POLICY IF EXISTS "Allow all for anon" ON holidays;
DROP POLICY IF EXISTS "Allow all for anon" ON special_days;
DROP POLICY IF EXISTS "Allow all for anon" ON audit_log;
DROP POLICY IF EXISTS "Allow all for anon" ON notification_settings;
DROP POLICY IF EXISTS "Allow all for anon" ON day_swaps;

-- ─── users ────────────────────────────────────────────────
-- pin_hash and auth_user_id are never exposed via the API, even to
-- authenticated users — column-level grant, not just a policy, so no future
-- policy change can accidentally leak them.
REVOKE SELECT ON users FROM authenticated, anon;
GRANT SELECT (id, username, display_name, role, is_active, created_at, updated_at,
              vacation_override, job_role, lang, regular_override, vacation_override_at)
  ON users TO authenticated;

CREATE POLICY "read all profiles" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages users" ON users FOR ALL TO authenticated
  USING (current_app_role() = 'super_admin')
  WITH CHECK (current_app_role() = 'super_admin');

-- ─── job_roles / staff_role_assignments / staffing_rules / holidays / locations ───
-- Everyone needs to read these (calendar, staffing checks, check-in); only
-- super_admin configures them.
CREATE POLICY "read job_roles" ON job_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages job_roles" ON job_roles FOR ALL TO authenticated
  USING (current_app_role() = 'super_admin') WITH CHECK (current_app_role() = 'super_admin');

CREATE POLICY "read staff_role_assignments" ON staff_role_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages staff_role_assignments" ON staff_role_assignments FOR ALL TO authenticated
  USING (current_app_role() = 'super_admin') WITH CHECK (current_app_role() = 'super_admin');

CREATE POLICY "read staffing_rules" ON staffing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages staffing_rules" ON staffing_rules FOR ALL TO authenticated
  USING (current_app_role() = 'super_admin') WITH CHECK (current_app_role() = 'super_admin');

CREATE POLICY "read holidays" ON holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages holidays" ON holidays FOR ALL TO authenticated
  USING (current_app_role() = 'super_admin') WITH CHECK (current_app_role() = 'super_admin');

CREATE POLICY "read locations" ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages locations" ON locations FOR ALL TO authenticated
  USING (current_app_role() = 'super_admin') WITH CHECK (current_app_role() = 'super_admin');

-- ─── special_days / notification_settings ─────────────────
-- Manager or super_admin configure these (matches the existing Admin Panel
-- menu, where these two are not marked super-admin-only).
CREATE POLICY "read special_days" ON special_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager+ manages special_days" ON special_days FOR ALL TO authenticated
  USING (current_app_role() IN ('manager', 'super_admin'))
  WITH CHECK (current_app_role() IN ('manager', 'super_admin'));

CREATE POLICY "read notification_settings" ON notification_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager+ manages notification_settings" ON notification_settings FOR ALL TO authenticated
  USING (current_app_role() IN ('manager', 'super_admin'))
  WITH CHECK (current_app_role() IN ('manager', 'super_admin'));

-- ─── leave_requests ────────────────────────────────────────
-- Staff: only their own. Manager: their own + any staff (never another
-- manager's, never approve their own — matches the in-app rule already
-- enforced in LeaveContext.approve()). Super admin: everything.
CREATE POLICY "read leave_requests" ON leave_requests FOR SELECT TO authenticated
  USING (
    user_id = current_app_user_id()
    OR (current_app_role() = 'manager' AND user_role = 'staff')
    OR current_app_role() = 'super_admin'
  );

CREATE POLICY "submit own leave_requests" ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = current_app_user_id()
    OR current_app_role() = 'super_admin'
    OR (current_app_role() = 'manager' AND user_role = 'staff')
  );

CREATE POLICY "update leave_requests" ON leave_requests FOR UPDATE TO authenticated
  USING (
    user_id = current_app_user_id()
    OR (current_app_role() = 'manager' AND user_role = 'staff')
    OR current_app_role() = 'super_admin'
  )
  WITH CHECK (
    user_id = current_app_user_id()
    OR (current_app_role() = 'manager' AND user_role = 'staff')
    OR current_app_role() = 'super_admin'
  );

CREATE POLICY "super admin deletes leave_requests" ON leave_requests FOR DELETE TO authenticated
  USING (current_app_role() = 'super_admin');

-- ─── audit_log ─────────────────────────────────────────────
-- Every role's actions get logged (insert stays open to authenticated), but
-- only super_admin can read the log back — matches the capability table.
-- Immutable: no update, no delete for anyone via the API.
CREATE POLICY "super admin reads audit_log" ON audit_log FOR SELECT TO authenticated
  USING (current_app_role() = 'super_admin');
CREATE POLICY "log own actions" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- ─── day_swaps ─────────────────────────────────────────────
CREATE POLICY "read own day_swaps" ON day_swaps FOR SELECT TO authenticated
  USING (
    proposer_id = current_app_user_id()
    OR receiver_id = current_app_user_id()
    OR current_app_role() IN ('manager', 'super_admin')
  );
CREATE POLICY "propose day_swaps" ON day_swaps FOR INSERT TO authenticated
  WITH CHECK (proposer_id = current_app_user_id());
CREATE POLICY "respond to day_swaps" ON day_swaps FOR UPDATE TO authenticated
  USING (
    proposer_id = current_app_user_id()
    OR receiver_id = current_app_user_id()
    OR current_app_role() IN ('manager', 'super_admin')
  )
  WITH CHECK (
    proposer_id = current_app_user_id()
    OR receiver_id = current_app_user_id()
    OR current_app_role() IN ('manager', 'super_admin')
  );
CREATE POLICY "super admin deletes day_swaps" ON day_swaps FOR DELETE TO authenticated
  USING (current_app_role() = 'super_admin');

-- ─── check_ins ─────────────────────────────────────────────
-- Own check-ins, or the attendance board (manager/super_admin) — matches
-- "Check-in/attendance board: staff = own only".
CREATE POLICY "read check_ins" ON check_ins FOR SELECT TO authenticated
  USING (
    user_id = current_app_user_id()
    OR current_app_role() IN ('manager', 'super_admin')
  );
CREATE POLICY "check self in" ON check_ins FOR INSERT TO authenticated
  WITH CHECK (user_id = current_app_user_id());
CREATE POLICY "update check_ins" ON check_ins FOR UPDATE TO authenticated
  USING (
    user_id = current_app_user_id()
    OR current_app_role() IN ('manager', 'super_admin')
  )
  WITH CHECK (
    user_id = current_app_user_id()
    OR current_app_role() IN ('manager', 'super_admin')
  );
CREATE POLICY "super admin deletes check_ins" ON check_ins FOR DELETE TO authenticated
  USING (current_app_role() = 'super_admin');

-- ─── push_subscriptions ────────────────────────────────────
-- Strictly your own device tokens. api/send-push.js reads across users via
-- the service role key server-side, which bypasses RLS entirely — it
-- doesn't need (and won't get) a policy here.
CREATE POLICY "manage own push_subscriptions" ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- ─── tasks ──────────────────────────────────────────────────
-- Left permissive on purpose: Task Board / Coffee Leaderboard were flagged
-- as "don't touch" this session, and this table's real usage pattern (who
-- can assign/complete tasks for whom) isn't something to guess at. Still
-- requires a real authenticated session — the anon key alone gets nothing —
-- but doesn't role-restrict within that. Tighten later with the team's input.
CREATE POLICY "authenticated use tasks" ON tasks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
