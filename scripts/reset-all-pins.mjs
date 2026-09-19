#!/usr/bin/env node
/**
 * One-off admin utility: resets every staff account's PIN in the LIVE
 * production Supabase database to a fresh, unique, random 4-digit PIN, and
 * prints the full username -> PIN table so you can log in and test with
 * known credentials.
 *
 * WARNING: this immediately invalidates every current staff member's
 * existing PIN. Anyone logged in stays logged in (session is just
 * localStorage), but nobody can log in again with their old PIN after
 * this runs — you'll need to redistribute the new PINs to real staff if
 * this app is in active use beyond testing.
 *
 * Usage:
 *   node scripts/reset-all-pins.mjs
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

const used = new Set();
function randomPin() {
  let pin;
  do { pin = String(crypto.randomInt(0, 10000)).padStart(4, '0'); } while (used.has(pin));
  used.add(pin);
  return pin;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: users, error } = await supabase.from('users').select('id, username, display_name, role').order('display_name');
  if (error) { console.error(error); process.exit(1); }

  console.log('═══════════════════════════════════════════════════');
  console.log(' RESET ALL PINS — production Supabase');
  console.log(`  ${users.length} accounts found`);
  console.log('═══════════════════════════════════════════════════\n');

  const results = [];
  for (const u of users) {
    const pin = randomPin();
    const { error: updErr } = await supabase
      .from('users')
      .update({ pin_hash: pin, updated_at: new Date().toISOString() })
      .eq('id', u.id);
    if (updErr) {
      console.error(`FAILED: ${u.username} — ${updErr.message}`);
      continue;
    }
    results.push({ displayName: u.display_name, username: u.username, role: u.role, pin });
  }

  console.log('\n=== NEW PINS ===');
  for (const r of results.sort((a, b) => a.displayName.localeCompare(b.displayName))) {
    console.log(`${r.displayName.padEnd(12)} | ${r.username.padEnd(10)} | ${r.role.padEnd(12)} | ${r.pin}`);
  }
  console.log(`\nTotal reset: ${results.length} / ${users.length}`);
}

main();
