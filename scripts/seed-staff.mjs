#!/usr/bin/env node
/**
 * Seeds the 12 real staff/guides that appear on the printed August/September
 * 2026 schedules into a fresh (staging) database, so import-tour-schedule.mjs
 * has real users to match against.
 *
 * Targets whichever project SUPABASE_URL/SUPABASE_ANON_KEY (or the VITE_
 * equivalents in .env.local) point at — same resolution as
 * import-tour-schedule.mjs. Run supabase-schema.sql on that project first.
 *
 * Usage:
 *   node scripts/seed-staff.mjs
 *
 * Safe to re-run — existing usernames are skipped, not overwritten.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadDotEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  ?? 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

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

// Same roster/roles as the production project, for the staff who appear on
// the printed calendars.
const STAFF = [
  { username: 'desiree', displayName: 'Desiree', role: 'staff' },
  { username: 'nabeel', displayName: 'Nabeel', role: 'super_admin' },
  { username: 'umer', displayName: 'Umer', role: 'staff' },
  { username: 'michael', displayName: 'Michael', role: 'manager' },
  { username: 'tiziano', displayName: 'Tiziano', role: 'staff' },
  { username: 'raza', displayName: 'Raza', role: 'staff' },
  { username: 'gunzan', displayName: 'Gunzan', role: 'staff' },
  { username: 'zack', displayName: 'Zack', role: 'manager' },
  { username: 'rihab', displayName: 'Rihab', role: 'staff' },
  { username: 'jo', displayName: 'JO', role: 'staff' },
  { username: 'sherry', displayName: 'Sherry', role: 'staff' },
  { username: 'kristina', displayName: 'Kristina', role: 'staff' },
];

function randomPin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('═══════════════════════════════════════════════════');
  console.log(' SEED STAFF');
  console.log(` Target project: ${SUPABASE_URL}`);
  console.log('═══════════════════════════════════════════════════\n');

  const { data: existing, error: fetchError } = await supabase.from('users').select('username');
  if (fetchError) {
    console.error('Failed to read users table — did you run supabase-schema.sql on this project first?');
    console.error(fetchError.message);
    process.exit(1);
  }
  const existingUsernames = new Set(existing.map((u) => u.username.toLowerCase()));

  const created = [];
  for (const staff of STAFF) {
    if (existingUsernames.has(staff.username)) {
      console.log(`skip (already exists): ${staff.displayName}`);
      continue;
    }
    const pin = randomPin();
    const { error } = await supabase.from('users').insert({
      id: `usr_${staff.username}`,
      username: staff.username,
      display_name: staff.displayName,
      pin_hash: pin,
      role: staff.role,
      is_active: true,
    });
    if (error) {
      console.error(`FAILED to create ${staff.displayName}:`, error.message);
      continue;
    }
    created.push({ ...staff, pin });
  }

  if (created.length > 0) {
    console.log('\nCreated (username / PIN — for local staging login only):');
    for (const c of created) console.log(`   • ${c.displayName}: ${c.username} / ${c.pin}`);
  } else {
    console.log('\nNothing new to create.');
  }
}

main();
