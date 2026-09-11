-- ═══════════════════════════════════════════════════════════
-- Show Me Italy Staff Calendar — Security Migration, Part 1
-- Run this FIRST in the Supabase SQL Editor. It is purely additive:
-- nothing here changes how the app currently behaves, so it's safe to run
-- immediately, before anything else in this migration.
--
-- What it does:
--   1. Links each `users` row to a real Supabase Auth account (once
--      scripts/migrate-users-to-auth.mjs has created one for them).
--   2. Adds two small helper functions RLS policies will use in Part 2 to
--      check "who is making this request" and "what's their role".
-- ═══════════════════════════════════════════════════════════

-- 1. Link public.users -> auth.users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id);

-- 2. Helper functions — SECURITY DEFINER so they can read `users` regardless
--    of the RLS policies we'll put on it in Part 2, and STABLE so Postgres
--    can reuse the result within one query instead of re-running it per row.

CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE auth_user_id = auth.uid();
$$;

-- Any logged-in (authenticated) user may call these — they only ever
-- reveal the caller's own id/role, nothing about anyone else.
GRANT EXECUTE ON FUNCTION current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION current_app_role() TO authenticated;
