#!/usr/bin/env node
/**
 * Bulk assign job roles to staff members from a CSV file.
 *
 * CSV Format:
 *   username,displayName,jobRoles
 *   desiree,Desiree,"Check In, Back Office"
 *
 * Usage:
 *   node scripts/bulk-assign-roles.mjs scripts/role-assignments-template.csv
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase
let db;
try {
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ firebase-service-account.json not found');
    console.error('Please create a service account key in Firebase Console and save it as firebase-service-account.json');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const app = initializeApp({
    credential: cert(serviceAccount),
  });
  db = getFirestore(app);
} catch (err) {
  console.error('Failed to initialize Firebase:', err.message);
  process.exit(1);
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/bulk-assign-roles.mjs <csv-file>');
    console.error('Example: node scripts/bulk-assign-roles.mjs scripts/role-assignments-template.csv');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  try {
    // Fetch job roles for mapping
    const jobRolesSnap = await db.collection('jobRoles').getDocs();
    const jobRoles = jobRolesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const roleIdMap = {};
    jobRoles.forEach(r => {
      roleIdMap[r.name.toLowerCase()] = r.id;
    });

    console.log('Available Job Roles:');
    jobRoles.forEach(r => {
      console.log(`  • ${r.name} (${r.id})`);
    });
    console.log('');

    // Parse CSV
    const assignments = [];
    let lineNum = 0;

    await new Promise((resolve, reject) => {
      const rl = createInterface({
        input: createReadStream(csvPath),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        lineNum++;
        if (lineNum === 1) return; // Skip header

        // Simple CSV parsing (doesn't handle quoted commas perfectly, but works for this case)
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length < 3) return;

        const username = parts[0];
        const displayName = parts[1];
        const rolesStr = parts[2];
        const roles = rolesStr.split(',').map(r => r.trim()).filter(Boolean);

        assignments.push({ username, displayName, roles });
      });

      rl.on('close', resolve);
      rl.on('error', reject);
    });

    console.log(`Parsed ${assignments.length} role assignments from ${csvPath}\n`);

    // Fetch all users and role assignments
    const usersSnap = await db.collection('users').getDocs();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const userMap = {};
    users.forEach(u => {
      userMap[u.username.toLowerCase()] = u;
    });

    const roleAssgSnap = await db.collection('roleAssignments').getDocs();
    const roleAssignments = roleAssgSnap.docs.map(d => ({ docId: d.id, ...d.data() }));

    console.log('Assigning roles...\n');

    let assigned = 0;
    let failed = 0;

    for (const assignment of assignments) {
      const user = userMap[assignment.username.toLowerCase()];
      if (!user) {
        console.log(`❌ User not found: ${assignment.username}`);
        failed++;
        continue;
      }

      // Remove existing role assignments for this user
      for (const existing of roleAssignments) {
        if (existing.userId === user.id) {
          try {
            await db.collection('roleAssignments').doc(existing.docId).delete();
          } catch (err) {
            console.warn(`  ⚠ Failed to delete existing role: ${err.message}`);
          }
        }
      }

      // Assign new roles
      for (const roleName of assignment.roles) {
        const roleId = roleIdMap[roleName.toLowerCase()];
        if (!roleId) {
          console.log(`  ⚠ Role not found: ${roleName}`);
          continue;
        }

        try {
          const assignId = `${user.id}_${roleId}`;
          await db.collection('roleAssignments').doc(assignId).set({
            id: assignId,
            userId: user.id,
            jobRoleId: roleId,
            isPrimary: false,
            assignedAt: new Date().toISOString(),
          });
          console.log(`✓ ${user.displayName || user.username} → ${roleName}`);
          assigned++;
        } catch (err) {
          console.log(`❌ Failed to assign ${roleName} to ${assignment.username}: ${err.message}`);
          failed++;
        }
      }
    }

    console.log(`\n════════════════════════════════════════════════════════`);
    console.log(`Assigned: ${assigned} roles`);
    console.log(`Failed: ${failed} assignments`);
    console.log(`════════════════════════════════════════════════════════`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
