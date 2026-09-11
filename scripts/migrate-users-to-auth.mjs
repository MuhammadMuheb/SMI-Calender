#!/usr/bin/env node
/**
 * DISABLED — DO NOT RUN. This script is incompatible with the app's current
 * login code and WILL permanently lock out every user it touches.
 *
 * `src/services/supabaseService.ts:authenticateUser` currently authenticates
 * by comparing the typed PIN directly against `users.pin_hash` (plaintext).
 * This script's whole job is to overwrite that same `pin_hash` column with
 * the literal string 'migrated' once it creates a Supabase Auth account —
 * but nothing in the client ever calls `supabase.auth.signInWithPassword`,
 * so once `pin_hash` is overwritten there is no code path left that can
 * authenticate that user. Their real PIN is destroyed, not just hashed.
 *
 * This was step 2 of an abandoned Supabase-Auth-based login rollout (see
 * supabase-security-migration-part1.sql / part2.sql, which are similarly
 * on hold). Do not resume that rollout by running this script in isolation.
 * If the Auth-based login is ever finished end-to-end and verified working,
 * remove this guard — until then, this exits immediately on purpose.
 */
console.error(
  'This script is disabled: it would overwrite pin_hash and break login for ' +
  'every user it touches. See the comment at the top of this file.'
);
process.exit(1);

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bchjkyavanfaegdbewnj.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard -> Project Settings -> API) and re-run.');
  process.exit(1);
}

// Keep in sync with src/utils/authPassword.ts
function toAuthPassword(pin) {
  return `smi_pin_${pin}`;
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, pin_hash, auth_user_id')
    .is('auth_user_id', null);

  if (error) {
    console.error('Failed to read users:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('Nothing to do — every user already has a Supabase Auth account.');
    return;
  }

  console.log(`Found ${users.length} user(s) without a Supabase Auth account:\n`);

  let migrated = 0;
  let failed = 0;

  for (const u of users) {
    const email = `${u.username}@smi.internal`;
    const password = toAuthPassword(u.pin_hash);

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    let authUserId = created?.user?.id;

    if (createErr) {
      // Already exists (e.g. a previous partial run) — look it up instead of failing.
      if (createErr.message?.toLowerCase().includes('already') || createErr.status === 422) {
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
        const existing = !listErr && list?.users?.find((au) => au.email === email);
        if (existing) {
          authUserId = existing.id;
          console.log(`  ${u.username}: Auth account already existed, linking it`);
        } else {
          console.error(`  ${u.username}: FAILED (${createErr.message})`);
          failed++;
          continue;
        }
      } else {
        console.error(`  ${u.username}: FAILED (${createErr.message})`);
        failed++;
        continue;
      }
    } else {
      console.log(`  ${u.username}: Auth account created`);
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ auth_user_id: authUserId, pin_hash: 'migrated' })
      .eq('id', u.id);

    if (updateErr) {
      console.error(`  ${u.username}: created Auth account but failed to link it (${updateErr.message})`);
      failed++;
      continue;
    }

    migrated++;
  }

  console.log(`\nDone. ${migrated} migrated, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main();
