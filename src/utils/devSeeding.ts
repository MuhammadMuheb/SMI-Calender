/**
 * DEVELOPMENT ONLY: Seed test users to Firestore
 * Usage: await window.seedTestUsers?.()
 * This is only available in development mode
 */
import { collection, setDoc, doc, getFirestore } from 'firebase/firestore';

const TEST_USERS = [
  { username: 'admin', displayName: 'Admin', pin: '1111', role: 'super_admin' },
  { username: 'sherry', displayName: 'Sherry', pin: '2222', role: 'staff' },
  { username: 'manager', displayName: 'Manager', pin: '3333', role: 'manager' },
  { username: 'staff1', displayName: 'Staff One', pin: '4444', role: 'staff' },
  { username: 'staff2', displayName: 'Staff Two', pin: '5555', role: 'staff' },
];

export async function seedTestUsers() {
  console.log('🔥 Seeding test users to Firestore...\n');

  const db = getFirestore();
  let created = 0;
  let skipped = 0;

  for (const user of TEST_USERS) {
    try {
      const userRef = doc(db, 'users', user.username.toLowerCase());
      const now = new Date().toISOString();

      await setDoc(userRef, {
        id: `usr_${user.username}`,
        username: user.username.toLowerCase(),
        displayName: user.displayName,
        pinHash: user.pin,
        role: user.role,
        isActive: true,
        jobRole: ['Office'],
        createdAt: now,
        updatedAt: now,
        vacationOverride: null,
        regularOverride: null,
      }, { merge: false });

      console.log(`✓ Created: ${user.displayName} (${user.username} / ${user.pin})`);
      created++;
    } catch (err) {
      if ((err as any)?.code === 'permission-denied') {
        console.log(`✗ ${user.displayName}: Permission denied (seeding might only work with auth credentials)`);
      } else {
        console.log(`✗ ${user.displayName}: ${(err as any)?.message}`);
      }
      skipped++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Seeding complete: ${created} created, ${skipped} failed`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`\nTest credentials:`);
  for (const user of TEST_USERS) {
    console.log(`  ${user.username.padEnd(12)} / ${user.pin}`);
  }

  return { created, skipped };
}

// Expose to window for development
if (typeof process !== 'undefined' && (process.env as any)?.NODE_ENV === 'development') {
  (window as any).seedTestUsers = seedTestUsers;
  console.log('💡 Dev tip: Type "await seedTestUsers()" in the console to seed test users');
}
