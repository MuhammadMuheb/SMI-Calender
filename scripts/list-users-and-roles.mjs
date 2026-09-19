#!/usr/bin/env node
/**
 * List all users and their current job role assignments from Firestore.
 * Helps identify which staff members need roles assigned.
 *
 * Usage:
 *   node scripts/list-users-and-roles.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try to load service account key
let db;
try {
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    const app = initializeApp({
      credential: cert(serviceAccount),
    });
    db = getFirestore(app);
    console.log('✓ Initialized Firebase Admin SDK with service account\n');
  } else {
    console.log('⚠ firebase-service-account.json not found');
    console.log('Please provide service account key for Firestore access\n');
    process.exit(1);
  }
} catch (err) {
  console.error('Failed to initialize Firebase:', err.message);
  process.exit(1);
}

async function main() {
  try {
    console.log('Fetching all users...\n');
    const usersSnap = await db.collection('users').getDocs();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Found ${users.length} users:\n`);

    console.log('Fetching all role assignments...\n');
    const rolesSnap = await db.collection('roleAssignments').getDocs();
    const roleAssignments = rolesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Found ${roleAssignments.length} role assignments:\n`);

    // Fetch job roles
    const jobRolesSnap = await db.collection('jobRoles').getDocs();
    const jobRoles = jobRolesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const roleMap = {};
    jobRoles.forEach(r => { roleMap[r.id] = r.name; });

    // Display users with their roles
    console.log('════════════════════════════════════════════════════════════════');
    console.log('USER ROSTER WITH CURRENT JOB ROLE ASSIGNMENTS');
    console.log('════════════════════════════════════════════════════════════════\n');

    users.forEach(user => {
      const assignments = roleAssignments.filter(a => a.userId === user.id);
      const roles = assignments.map(a => roleMap[a.jobRoleId] || a.jobRoleId).join(', ');
      const rolesDisplay = roles ? `✓ ${roles}` : '✗ NO ROLES ASSIGNED';
      console.log(`${user.displayName || user.username || user.id}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Username: ${user.username || 'N/A'}`);
      console.log(`  Role: ${user.role || 'unknown'}`);
      console.log(`  Active: ${user.isActive !== false ? 'Yes' : 'No'}`);
      console.log(`  Job Roles: ${rolesDisplay}`);
      console.log('');
    });

    // Summary
    const usersWithRoles = users.filter(u =>
      roleAssignments.some(a => a.userId === u.id)
    );
    const usersWithoutRoles = users.filter(u =>
      !roleAssignments.some(a => a.userId === u.id)
    );

    console.log('════════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`Total Users: ${users.length}`);
    console.log(`Users with Roles: ${usersWithRoles.length}`);
    console.log(`Users WITHOUT Roles: ${usersWithoutRoles.length}\n`);

    if (usersWithoutRoles.length > 0) {
      console.log('Users needing role assignments:');
      usersWithoutRoles.forEach(u => {
        console.log(`  • ${u.displayName || u.username || u.id}`);
      });
    }

    console.log('\nAvailable Job Roles:');
    jobRoles.forEach(r => {
      console.log(`  • ${r.name} (${r.id})`);
    });

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
