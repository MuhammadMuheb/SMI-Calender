#!/usr/bin/env node
/**
 * Imports the historical August/September 2026 tour schedule (parsed from the
 * printed calendar PDFs) into the `tour_assignments` table.
 *
 * 1. Cross-references every name in the schedule against the `users` table.
 * 2. Prints a validation warning for any name with no matching user — those
 *    entries are skipped, nothing is written for them.
 * 3. For matched staff, upserts one row per (user, date) into tour_assignments.
 *
 * Usage:
 *   node scripts/import-tour-schedule.mjs            # dry run (default) — no writes
 *   node scripts/import-tour-schedule.mjs --apply     # actually writes to Supabase
 *
 * Targets whichever project SUPABASE_URL / SUPABASE_ANON_KEY point at (falls
 * back to the same VITE_SUPABASE_* vars the app itself uses, read from
 * .env.local, then to the production project as a last resort). To run this
 * against a staging project instead, set SUPABASE_URL/SUPABASE_ANON_KEY (or
 * VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) in your shell or .env.local before
 * running this script.
 *
 * Requires the `tour_assignments` table to exist on the target project — run
 * supabase-schema.sql then supabase-tour-assignments-migration.sql first.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadDotEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  ?? 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

const APPLY = process.argv.includes('--apply');

function loadDotEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Maps the exact spellings that appear on the printed calendars to the
// `username` each one refers to in the `users` table. Update this if new
// nicknames/misspellings show up in future schedules.
const NAME_TO_USERNAME = {
  desiree: 'desiree',
  nabeel: 'nabeel',
  umer: 'umer',
  michael: 'michael',
  tiziano: 'tiziano',
  raza: 'raza',
  reza: 'raza', // "Reza" is a misspelling of "Raza" used throughout the Sep calendar
  gunzan: 'gunzan',
  zack: 'zack',
  rihab: 'rihab',
  sherry: 'sherry',
  kristina: 'kristina',
  jo: 'jo',
};

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const entries = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'schedule-2026-08-09.json'), 'utf8'),
  );

  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, display_name, is_active');
  if (error) {
    console.error('Failed to fetch users from Supabase:', error.message);
    process.exit(1);
  }
  const usersByUsername = new Map(users.map((u) => [u.username.toLowerCase(), u]));

  const missingNames = new Map(); // calendarName -> count
  const matchedByUser = new Map(); // userId -> {displayName, dates: Set}
  const notes = [];

  for (const entry of entries) {
    if (!entry.name) {
      notes.push(entry);
      continue;
    }
    const key = entry.name.toLowerCase();
    const username = NAME_TO_USERNAME[key];
    const user = username ? usersByUsername.get(username) : undefined;

    if (!user) {
      missingNames.set(entry.name, (missingNames.get(entry.name) ?? 0) + 1);
      continue;
    }

    if (!matchedByUser.has(user.id)) {
      matchedByUser.set(user.id, { displayName: user.display_name, username: user.username, dates: new Set() });
    }
    matchedByUser.get(user.id).dates.add(entry.date);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log(' TOUR SCHEDULE IMPORT — August & September 2026');
  console.log(` Target project: ${SUPABASE_URL}`);
  console.log(` Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (read-only)'}`);
  console.log('═══════════════════════════════════════════════════\n');

  if (missingNames.size > 0) {
    console.log('⚠️  VALIDATION WARNINGS — these names appear on the printed');
    console.log('   calendars but have no matching user in the database.');
    console.log('   Add them as staff first, then re-run this import:\n');
    for (const [name, count] of missingNames) {
      console.log(`   • "${name}" — ${count} scheduled day(s) will be SKIPPED until this person is added`);
    }
    console.log('');
  } else {
    console.log('✅ Every name on the calendars matched an existing user.\n');
  }

  console.log(`Matched staff (${matchedByUser.size}):`);
  for (const [, info] of matchedByUser) {
    console.log(`   • ${info.displayName} (${info.username}) — ${info.dates.size} day(s)`);
  }

  if (notes.length > 0) {
    console.log(`\nManager notes found on the calendar (not imported as assignments):`);
    for (const n of notes) console.log(`   • ${n.date}: ${n.note}`);
  }

  const rows = [];
  for (const [userId, info] of matchedByUser) {
    for (const date of info.dates) {
      rows.push({
        id: `ta_${userId}_${date}`,
        userId,
        date,
        source: 'import:2026-08-09',
      });
    }
  }

  console.log(`\nTotal tour assignments ready to import: ${rows.length}`);

  if (!APPLY) {
    console.log('\nDry run only — no data was written. Re-run with --apply to insert these rows.');
    return;
  }

  console.log('\nApplying — writing to tour_assignments ...');
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: upsertError } = await supabase.from('tour_assignments').upsert(
      chunk.map((r) => ({ id: r.id, user_id: r.userId, date: r.date, source: r.source })),
      { onConflict: 'user_id,date' },
    );
    if (upsertError) {
      console.error(`Failed on chunk starting at ${i}:`, upsertError.message, upsertError.details);
      process.exit(1);
    }
  }
  console.log(`Done — ${rows.length} tour assignments written.`);
}

main();
