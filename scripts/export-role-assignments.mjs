#!/usr/bin/env node
/**
 * Export staff role assignments from production Supabase
 * and restore them to Firestore.
 *
 * This reads from the original Supabase database where the data
 * was initially stored, then imports it into Firestore.
 *
 * Usage:
 *   node scripts/export-role-assignments.mjs --export    # Just show the data
 *   node scripts/export-role-assignments.mjs --apply      # Export and import to Firestore
 */

import { createClient } from '@supabase/supabase-js';
import { getDb } from './lib/firebaseAdmin.mjs';

const APPLY = process.argv.includes('--apply');

// Production Supabase credentials (from migrate-supabase-to-firestore.mjs)
const SUPABASE_URL = 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' EXPORT ROLE ASSIGNMENTS FROM SUPABASE');
  console.log(`Mode: ${APPLY ? 'EXPORT & APPLY TO FIRESTORE' : 'EXPORT ONLY'}`);
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Connect to production Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Fetch role assignments
    console.log('Fetching staff_role_assignments from Supabase...');
    const { data: roleAssignments, error: roleError } = await supabase
      .from('staff_role_assignments')
      .select('*');

    if (roleError) {
      console.error('❌ Error fetching role assignments:', roleError.message);
      process.exit(1);
    }

    if (!roleAssignments || roleAssignments.length === 0) {
      console.error('❌ No role assignments found in Supabase');
      process.exit(1);
    }

    console.log(`✓ Found ${roleAssignments.length} role assignments\n`);

    // Fetch users and job roles to show names
    const { data: users } = await supabase.from('users').select('id, username, display_name');
    const { data: jobRoles } = await supabase.from('job_roles').select('id, name');

    const userMap = {};
    const roleMap = {};
    users?.forEach(u => { userMap[u.id] = u; });
    jobRoles?.forEach(r => { roleMap[r.id] = r; });

    // Display the data
    console.log('ROLE ASSIGNMENTS:\n');
    console.log('User → Job Role(s)');
    console.log('────────────────────────────────────────');

    // Group by user
    const byUser = {};
    roleAssignments.forEach(a => {
      if (!byUser[a.user_id]) byUser[a.user_id] = [];
      byUser[a.user_id].push(a);
    });

    for (const userId in byUser) {
      const user = userMap[userId];
      const roles = byUser[userId].map(a => roleMap[a.job_role_id]?.name || a.job_role_id).join(', ');
      console.log(`${user?.display_name || user?.username || userId}`);
      console.log(`  → ${roles}`);
    }

    // Generate CSV format for reference
    console.log('\n\nCSV FORMAT (for reference):\n');
    console.log('username,displayName,jobRoles');
    for (const userId in byUser) {
      const user = userMap[userId];
      const roles = byUser[userId].map(a => roleMap[a.job_role_id]?.name || a.job_role_id).join(', ');
      console.log(`${user?.username || userId},${user?.display_name || 'Unknown'},"${roles}"`);
    }

    // Apply to Firestore if requested
    if (APPLY) {
      console.log('\n\nApplying to Firestore...\n');
      const db = getDb();
      const batch = db.batch();

      for (const assignment of roleAssignments) {
        const docId = assignment.id;
        const docRef = db.collection('roleAssignments').doc(String(docId));
        batch.set(docRef, {
          id: assignment.id,
          userId: assignment.user_id,
          jobRoleId: assignment.job_role_id,
          isPrimary: assignment.is_primary || false,
          assignedAt: assignment.assigned_at || new Date().toISOString(),
        }, { merge: true });
      }

      await batch.commit();
      console.log(`✓ Successfully restored ${roleAssignments.length} role assignments to Firestore`);
    } else {
      console.log('\n\n(Run with --apply to restore these to Firestore)');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
