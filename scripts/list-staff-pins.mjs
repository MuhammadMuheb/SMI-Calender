#!/usr/bin/env node
/**
 * List all staff members with their usernames, display names, and PINs from Firestore.
 *
 * Requires Firebase credentials in ONE of these ways:
 *   1. scripts/firebase-admin-key.json
 *   2. Environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
 *   3. FIREBASE_ADMIN_SDK env var pointing to service account JSON
 *
 * Usage:
 *   node scripts/list-staff-pins.mjs
 */
import { getDb } from './lib/firebaseAdmin.mjs';

const db = getDb();

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    FIRESTORE STAFF MEMBERS & PINs                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const usersSnap = await db.collection('users').orderBy('displayName').get();

    if (usersSnap.empty) {
      console.log('❌ No users found in Firestore\n');
      process.exit(0);
    }

    const users = usersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`Total Users: ${users.length}\n`);
    console.log('┌─────┬────────────────┬──────────────────┬─────────────────────────────┐');
    console.log('│ #   │ Username       │ Display Name     │ PIN (pinHash)               │');
    console.log('├─────┼────────────────┼──────────────────┼─────────────────────────────┤');

    users.forEach((user, index) => {
      const num = String(index + 1).padStart(3, ' ');
      const username = (user.username || 'N/A').padEnd(14);
      const displayName = (user.displayName || 'N/A').padEnd(16);
      const pin = user.pinHash || user.pin || '(not set)';
      console.log(`│ ${num} │ ${username} │ ${displayName} │ ${pin} │`);
    });

    console.log('└─────┴────────────────┴──────────────────┴─────────────────────────────┘\n');

    // Summary
    const activeCount = users.filter(u => u.isActive).length;
    const inactiveCount = users.filter(u => !u.isActive).length;
    const withPins = users.filter(u => u.pinHash || u.pin).length;

    console.log(`Summary:`);
    console.log(`  • Active users: ${activeCount}`);
    console.log(`  • Inactive users: ${inactiveCount}`);
    console.log(`  • Users with PINs: ${withPins}/${users.length}`);
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
