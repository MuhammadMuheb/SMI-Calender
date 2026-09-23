/**
 * CALENDAR DATA VERIFICATION
 *
 * Local testing script to verify PDF-based data was ingested correctly.
 * DO NOT PUSH - This is for local testing only.
 */

import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { cleanupOrphanedSchedules } from '@/services/firestore/users';

interface VerificationReport {
  timestamp: string;
  usersCount: number;
  rolesCount: number;
  schedulesCount: number;
  augustSchedules: number;
  septemberSchedules: number;
  dataIntegrity: {
    allUsersActive: boolean;
    allSchedulesHaveDate: boolean;
    allSchedulesHaveStaff: boolean;
  };
  issues: string[];
  success: boolean;
}

/**
 * Verify all ingested calendar data matches PDF requirements
 * NO MOCK DATA - Verify only real data from PDFs
 */
export async function verifyCalendarData(): Promise<VerificationReport> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 VERIFYING CALENDAR DATA INTEGRITY`);
  console.log(`${'═'.repeat(60)}`);

  const db = getFirestore();
  const issues: string[] = [];
  let success = true;

  try {
    // Fetch all users
    console.log(`\n📋 Checking users...`);
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => doc.data());
    console.log(`  Found ${users.length} users`);

    // Verify all users are active
    const inactiveUsers = users.filter(u => !u.isActive);
    const allUsersActive = inactiveUsers.length === 0;
    if (!allUsersActive) {
      issues.push(`❌ ${inactiveUsers.length} inactive users found (expected all active)`);
      success = false;
    } else {
      console.log(`  ✓ All users are active`);
    }

    // Fetch all job roles
    console.log(`\n📋 Checking job roles...`);
    const rolesSnapshot = await getDocs(collection(db, 'jobRoles'));
    const roles = rolesSnapshot.docs.map(doc => doc.data());
    console.log(`  Found ${roles.length} job roles`);

    if (roles.length === 0) {
      issues.push(`⚠️  No job roles found (should have roles from calendar)`);
    } else {
      console.log(`  Roles: ${roles.map(r => r.name).join(', ')}`);
    }

    // Fetch all schedules
    console.log(`\n📋 Checking schedules...`);
    const schedulesSnapshot = await getDocs(collection(db, 'schedules'));
    const schedules = schedulesSnapshot.docs.map(doc => doc.data());
    console.log(`  Found ${schedules.length} total schedules`);

    // Verify schedule data integrity
    const allSchedulesHaveDate = schedules.every(s => s.date);
    const allSchedulesHaveStaff = schedules.every(s => s.guide);

    if (!allSchedulesHaveDate) {
      issues.push(`❌ Some schedules missing date field`);
      success = false;
    }
    if (!allSchedulesHaveStaff) {
      issues.push(`❌ Some schedules missing staff/guide field`);
      success = false;
    }

    // Count August vs September schedules
    const augustSchedules = schedules.filter(s => s.date?.startsWith('2026-08')).length;
    const septemberSchedules = schedules.filter(s => s.date?.startsWith('2026-09')).length;

    console.log(`  August schedules: ${augustSchedules}`);
    console.log(`  September schedules: ${septemberSchedules}`);

    if (augustSchedules === 0 && septemberSchedules === 0) {
      issues.push(`⚠️  No schedules found (expected data from both calendar PDFs)`);
      success = false;
    }

    // Check for orphaned schedules (staff not in users)
    console.log(`\n📋 Checking data relationships...`);
    const userNames = users.map(u => u.displayName.toLowerCase());
    const orphanedSchedules = schedules.filter(s =>
      s.guide && !userNames.includes(s.guide.toLowerCase())
    );

    if (orphanedSchedules.length > 0) {
      issues.push(`⚠️  ${orphanedSchedules.length} schedules reference staff not in users collection`);
      console.log(`  Orphaned staff: ${orphanedSchedules.map(s => s.guide).join(', ')}`);
    } else {
      console.log(`  ✓ All scheduled staff exist in users collection`);
    }

    // Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`VERIFICATION SUMMARY`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Users:            ${users.length}`);
    console.log(`Job Roles:        ${roles.length}`);
    console.log(`Total Schedules:  ${schedules.length}`);
    console.log(`  - August:       ${augustSchedules}`);
    console.log(`  - September:    ${septemberSchedules}`);
    console.log(`Data Integrity:   ${allUsersActive ? '✓' : '✗'}`);

    if (issues.length > 0) {
      console.log(`\n⚠️  ISSUES FOUND:`);
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log(`\n✓ ALL CHECKS PASSED - Data is valid and complete`);
    }

    console.log(`${'═'.repeat(60)}\n`);

    return {
      timestamp: new Date().toISOString(),
      usersCount: users.length,
      rolesCount: roles.length,
      schedulesCount: schedules.length,
      augustSchedules,
      septemberSchedules,
      dataIntegrity: {
        allUsersActive,
        allSchedulesHaveDate,
        allSchedulesHaveStaff,
      },
      issues,
      success: success && orphanedSchedules.length === 0,
    };
  } catch (err) {
    console.error(`\n✗ VERIFICATION FAILED:`, err);
    throw err;
  }
}

/**
 * Check if data matches expected counts from PDFs
 * (Counts to be set after PDF review)
 */
export async function verifyExpectedCounts(expectedUsers: number, expectedRoles: number, expectedAugust: number, expectedSeptember: number) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 VERIFYING EXPECTED DATA COUNTS FROM PDFs`);
  console.log(`${'═'.repeat(60)}`);

  const report = await verifyCalendarData();

  const counts = [
    { label: 'Users', expected: expectedUsers, actual: report.usersCount },
    { label: 'Job Roles', expected: expectedRoles, actual: report.rolesCount },
    { label: 'August Schedules', expected: expectedAugust, actual: report.augustSchedules },
    { label: 'September Schedules', expected: expectedSeptember, actual: report.septemberSchedules },
  ];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`COUNT VERIFICATION`);
  console.log(`${'═'.repeat(60)}`);

  let allMatch = true;
  counts.forEach(({ label, expected, actual }) => {
    const match = expected === actual;
    const icon = match ? '✓' : '✗';
    console.log(`${icon} ${label.padEnd(20)}: expected ${expected}, got ${actual}`);
    if (!match) allMatch = false;
  });

  console.log(`${'═'.repeat(60)}`);
  if (allMatch) {
    console.log(`✓ ALL COUNTS MATCH - Data ingestion successful`);
  } else {
    console.log(`✗ COUNT MISMATCH - Please review data ingestion`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  return { report, allMatch };
}

// Expose to window for development testing
if (import.meta.env.MODE === 'development') {
  (window as any).verifyCalendarData = verifyCalendarData;
  (window as any).verifyExpectedCounts = verifyExpectedCounts;
  (window as any).cleanupOrphanedSchedules = cleanupOrphanedSchedules;
  console.log('💡 Verification commands available:');
  console.log('   - await verifyCalendarData() - Verify data integrity');
  console.log('   - await verifyExpectedCounts(users, roles, august, sept) - Verify exact counts');
  console.log('   - await cleanupOrphanedSchedules() - Remove orphaned schedule entries');
}
