#!/usr/bin/env node
/**
 * Seeds 12 staff members into Firestore.
 *
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-staff.mjs
 *
 * Safe to re-run — existing usernames are skipped.
 */
import { services } from '../server/firebase.cjs';
import { hashPin } from '../server/credentials.cjs';
import crypto from 'node:crypto';
const { db } = services();

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
  console.log('═══════════════════════════════════════════════════');
  console.log(' SEED STAFF TO FIRESTORE');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Get existing users
    const usersSnap = await db.collection('users').get();
    const existingUsernames = new Set(usersSnap.docs.map(d => d.data().username?.toLowerCase()));

    const created = [];
    for (const staff of STAFF) {
      if (existingUsernames.has(staff.username)) {
        console.log(`skip (already exists): ${staff.displayName}`);
        continue;
      }

      const pin = randomPin();
      const userId = `usr_${staff.username}`;

      const batch = db.batch();
      batch.set(db.collection('users').doc(userId), {
        id: userId,
        username: staff.username,
        displayName: staff.displayName,
        role: staff.role,
        isActive: true,
      });

      batch.set(db.collection('user_credentials').doc(userId), { pinHash: hashPin(pin) });
      await batch.commit();
      created.push({ ...staff, pin });
      console.log(`✓ Created: ${staff.displayName}`);
    }

    if (created.length > 0) {
      console.log('\n' + '═'.repeat(50));
      console.log('Created users (username / PIN):');
      for (const c of created) {
        console.log(`   • ${c.displayName}: ${c.username} / ${c.pin}`);
      }
      console.log('═'.repeat(50));
    } else {
      console.log('\nNothing new to create.');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
