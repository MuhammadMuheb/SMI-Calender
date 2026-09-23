import { serverApi } from '@/lib/serverApi';
import {
  type DocumentReference, collection, getDocs, writeBatch, query, where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { StaffUser } from '@/models/user';
import type { Role } from '@/config/roles';

export async function fetchUsers(): Promise<StaffUser[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        if (!data) return null;

        const username = (data.username ?? docSnap.id) as string;
        const displayName = (data.displayName ?? data.name ?? username) as string;
        const id = (data.id ?? docSnap.id) as string;

        return {
          id,
          username,
          displayName,
          pin: '',
          role: (data.role ?? 'staff') as Role,
          isActive: data.isActive !== false,
          createdAt: (data.createdAt ?? new Date().toISOString()) as string,
          updatedAt: (data.updatedAt ?? new Date().toISOString()) as string,
          vacationOverride: (data.vacationOverride as number | null) ?? null,
          regularOverride: (data.regularOverride as number | null) ?? null,
          jobRole: (Array.isArray(data.jobRole) ? data.jobRole : ['Office']) as string[],
        } as StaffUser;
      })
      .filter((u): u is StaffUser => u !== null);

    // CRITICAL: Deduplicate by BOTH ID and USERNAME
    // Multiple documents with different IDs but same username must be filtered
    // Keep only the first occurrence by ID, then deduplicate by username
    const seenIds = new Set<string>();
    const seenUsernames = new Set<string>();
    const uniqueUsers: StaffUser[] = [];

    for (const user of users) {
      const usernameLower = user.username.toLowerCase().trim();

      // Skip if we've already seen this username
      if (seenUsernames.has(usernameLower)) {
        console.warn(`[Deduplication] Duplicate username detected: "${user.displayName}" (username: ${usernameLower}, id: ${user.id}) - FILTERED OUT`);
        continue;
      }

      // Skip if we've already seen this ID
      if (seenIds.has(user.id)) {
        console.warn(`[Deduplication] Duplicate user ID detected: "${user.displayName}" (id: ${user.id}) - keeping first occurrence only`);
        continue;
      }

      // This is a unique user - add it
      seenIds.add(user.id);
      seenUsernames.add(usernameLower);
      uniqueUsers.push(user);
    }

    if (uniqueUsers.length < users.length) {
      const duplicatesRemoved = users.length - uniqueUsers.length;
      console.log(`[Deduplication] ✓ Removed ${duplicatesRemoved} duplicate user record(s). Final count: ${uniqueUsers.length} unique active users`);
    }

    return uniqueUsers;
  } catch (err) {
    console.error('fetchUsers:', err);
    return [];
  }
}

export async function insertUser(user: {
  id: string;
  username: string;
  displayName: string;
  pin: string;
  role: Role;
}): Promise<string> {
  await serverApi('users', { action: 'create', id: user.id, updates: user });
  return user.id;
}
export async function updateUserDb(id: string, updates: Record<string, unknown>): Promise<void> {
  await serverApi('users', { action: 'update', id, updates });
}
export async function deleteUserDb(id: string): Promise<void> {
  await serverApi('users', { action: 'delete', id });
}

/**
 * Delete all role assignments for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserRoleAssignments(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'role_assignments'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    return snapshot.size;
  } catch (err) {
    console.error(`Error deleting role assignments:`, err);
    throw err;
  }
}

/**
 * Delete all leave requests for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserLeaveRequests(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'leave_requests'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    return snapshot.size;
  } catch (err) {
    console.error(`Error deleting leave requests:`, err);
    throw err;
  }
}

/**
 * Delete all check-ins for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserCheckIns(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'check_ins'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    return snapshot.size;
  } catch (err) {
    console.error(`Error deleting check-ins:`, err);
    throw err;
  }
}

/**
 * Delete all tour assignments for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserTourAssignments(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'tour_assignments'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    return snapshot.size;
  } catch (err) {
    console.error(`Error deleting tour assignments:`, err);
    throw err;
  }
}

/**
 * Delete all task assignments for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserTasks(userId: string): Promise<number> {
  try {
    const snapshots = await Promise.all(['assignedTo', 'assigned_to'].map(field => getDocs(query(collection(db, 'tasks'), where(field, '==', userId)))));
    const docs = [...new Map(snapshots.flatMap(s => s.docs).map(d => [d.id, d])).values()];
    if (!docs.length) return 0;
    const batch = writeBatch(db);
    docs.forEach(d => batch.update(d.ref, { assignedTo: null, assigned_to: null, assignedToName: '', assigned_to_name: '', updatedAt: new Date().toISOString() }));
    await batch.commit();
    return docs.length;
  } catch (err) {
    console.error(`Error updating task assignments:`, err);
    throw err;
  }
}

/**
 * Delete all schedule entries for a user
 * CRITICAL: Prevents deleted users from appearing in calendar/tour views
 * Searches by displayName since schedules store guide name, not userId
 * IMPORTANT: Must fetch user from Firestore directly (not through fetchUsers which filters)
 */
export async function deleteUserSchedules(userId: string): Promise<number> {
  try {
    // Query Firestore directly to get user - bypasses active filter to find user being deleted
    const userSnap = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));
    if (userSnap.empty) return 0;

    const user = userSnap.docs[0].data();
    const displayName = user.displayName || user.name;
    if (!displayName) return 0;

    // Schedules reference users by displayName, not by ID
    const q = query(collection(db, 'schedules'), where('guide', '==', displayName));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    console.log(`[Schedule Deletion] Deleted ${snapshot.size} schedule entries for user ${displayName}`);
    return snapshot.size;
  } catch (err) {
    console.error(`Error deleting schedules:`, err);
    throw err;
  }
}

/**
 * ENHANCED DELETION: Supports both HARD DELETE (wipe all data) and SOFT DELETE (archive account)
 *
 * Hard Delete: Permanently removes user and ALL associated data
 * - Deletes user account from users collection
 * - Deletes all leave requests
 * - Deletes all role assignments
 * - Deletes all check-ins
 * - Deletes all tour assignments
 * - Clears task assignments
 *
 * Soft Delete: Deactivates account but retains data (hidden from active views)
 * - Marks user as isActive = false
 * - Data stays in database but filtered out by active queries
 * - Audit trail preserved for compliance
 */
export async function deleteUserWithDataHandling(
  userId: string,
  mode: 'hard_delete' | 'soft_delete'
): Promise<{ success: boolean; deletedCounts: Record<string, number>; message: string }> {
  if (auth.currentUser?.uid === userId) throw new Error('You cannot delete or archive your own account');
  try {
    // CRITICAL FIX: Query Firestore directly to find user (not fetchUsers which filters inactive)
    // This prevents "not found" errors when attempting to delete already-inactive users
    const userSnap = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));

    if (userSnap.empty) {
      throw new Error(`User with ID "${userId}" not found in Firestore`);
    }

    const userData = userSnap.docs[0].data();
    const user = {
      id: userData.id || userSnap.docs[0].id,
      username: userData.username || userData.name || userSnap.docs[0].id,
      displayName: userData.displayName || userData.name || userData.username || userSnap.docs[0].id,
      isActive: userData.isActive !== false,
    };

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`USER DELETION - ${mode.toUpperCase()}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`User: ${user.displayName} (${user.username}, ID: ${user.id})`);
    console.log(`Mode: ${mode === 'hard_delete' ? '🗑️ PERMANENT DELETE' : '📦 ARCHIVE (SOFT DELETE)'}`);

    const deletedCounts: Record<string, number> = {
      user: 0,
      leaveRequests: 0,
      roleAssignments: 0,
      checkIns: 0,
      tourAssignments: 0,
      tasks: 0,
      schedules: 0,
    };

    if (mode === 'hard_delete') {
      // HARD DELETE: Remove all traces of the user
      console.log(`\n[HARD DELETE] Initiating complete purge...`);
      console.log(`[HARD DELETE] Deleting cascade data (in parallel)...`);

      // Delete cascading data first - with proper error handling
      try {
        const [leaveCount, roleCount, checkinCount, tourCount, taskCount, scheduleCount] = await Promise.all([
          deleteUserLeaveRequests(userId).catch(err => {
            console.error(`[HARD DELETE] Leave requests deletion failed: ${err.message}`);
            throw err;
          }),
          deleteUserRoleAssignments(userId).catch(err => {
            console.error(`[HARD DELETE] Role assignments deletion failed: ${err.message}`);
            throw err;
          }),
          deleteUserCheckIns(userId).catch(err => {
            console.error(`[HARD DELETE] Check-ins deletion failed: ${err.message}`);
            throw err;
          }),
          deleteUserTourAssignments(userId).catch(err => {
            console.error(`[HARD DELETE] Tour assignments deletion failed: ${err.message}`);
            throw err;
          }),
          deleteUserTasks(userId).catch(err => {
            console.error(`[HARD DELETE] Tasks deletion failed: ${err.message}`);
            throw err;
          }),
          deleteUserSchedules(userId).catch(err => {
            console.error(`[HARD DELETE] Schedules deletion failed: ${err.message}`);
            throw err;
          }),
        ]);

        deletedCounts.leaveRequests = leaveCount;
        deletedCounts.roleAssignments = roleCount;
        deletedCounts.checkIns = checkinCount;
        deletedCounts.tourAssignments = tourCount;
        deletedCounts.tasks = taskCount;
        deletedCounts.schedules = scheduleCount;

        console.log(`[HARD DELETE] ✓ Cascade data purged successfully:`);
        console.log(`  ✓ Leave requests: ${leaveCount}`);
        console.log(`  ✓ Role assignments: ${roleCount}`);
        console.log(`  ✓ Check-ins: ${checkinCount}`);
        console.log(`  ✓ Tour assignments: ${tourCount}`);
        console.log(`  ✓ Tasks unassigned: ${taskCount}`);
        console.log(`  ✓ Schedule entries: ${scheduleCount}`);
      } catch (cascadeErr) {
        console.error(`[HARD DELETE] ✗ CASCADE DELETION FAILED - aborting user document deletion`);
        throw new Error(`Cascade deletion failed: ${(cascadeErr instanceof Error ? cascadeErr.message : String(cascadeErr))}`);
      }

      // Only delete user document if ALL cascade deletes succeeded
      console.log(`[HARD DELETE] All cascade deletes succeeded. Deleting user document...`);
      try {
        await deleteUserDb(userId);
        deletedCounts.user = 1;
        console.log(`[HARD DELETE] ✓ User document successfully deleted`);
      } catch (userDelErr) {
        console.error(`[HARD DELETE] ✗ CRITICAL: User document deletion FAILED`);
        throw userDelErr;
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✓ HARD DELETE COMPLETE - ALL DATA PERMANENTLY REMOVED`);
      console.log(`User: "${user.displayName}" (${user.username})`);
      console.log(`Total records deleted: ${Object.values(deletedCounts).reduce((a, b) => a + b, 0)}`);
      console.log(`${'═'.repeat(60)}\n`);

      return {
        success: true,
        deletedCounts,
        message: `Permanently deleted "${user.displayName}" and all associated data (${Object.values(deletedCounts).reduce((a, b) => a + b, 0)} records removed).`,
      };
    } else {
      // SOFT DELETE: Just mark as inactive (data remains but hidden)
      console.log(`\n[SOFT DELETE] Marking account as inactive...`);

      await updateUserDb(userId, { isActive: false });

      deletedCounts.user = 1;
      console.log(`  ✓ User marked as inactive`);
      console.log(`  ✓ Historical data retained and archived`);

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✓ SOFT DELETE COMPLETE`);
      console.log(`Account "${user.displayName}" archived. Data retained for records.`);
      console.log(`${'═'.repeat(60)}\n`);

      return {
        success: true,
        deletedCounts,
        message: `Archived account "${user.displayName}". Historical data retained and hidden from active views.`,
      };
    }
  } catch (err) {
    console.error(`\n${'═'.repeat(60)}`);
    console.error(`✗ USER DELETION FAILED - ${mode.toUpperCase()}`);
    console.error(`${'═'.repeat(60)}`);
    console.error(`Error: ${(err instanceof Error ? err.message : String(err))}`);
    console.error(`${'═'.repeat(60)}\n`);

    throw err;
  }
}

/**
 * Clean up orphaned schedules (schedules that reference users no longer in the users collection)
 * Runs periodically to maintain data integrity and prevent ghost entries
 */
export async function cleanupOrphanedSchedules(): Promise<number> {
  try {
    const allUsers = await getDocs(collection(db, 'users'));
    const validUserNames = new Set(
      allUsers.docs.map(doc => (doc.data().displayName || doc.data().name || '').toLowerCase())
    );

    const schedules = await getDocs(collection(db, 'schedules'));
    const orphanedDocs: DocumentReference[] = [];

    schedules.docs.forEach(doc => {
      const guide = (doc.data().guide || '').toLowerCase();
      if (guide && !validUserNames.has(guide)) {
        orphanedDocs.push(doc.ref);
      }
    });

    if (orphanedDocs.length === 0) return 0;

    // Delete in batches to respect Firestore limits
    for (let offset = 0; offset < orphanedDocs.length; offset += 450) {
      const batch = writeBatch(db);
      orphanedDocs.slice(offset, offset + 450).forEach(ref => batch.delete(ref));
      await batch.commit();
    }
    console.log(`[Orphan Cleanup] Deleted ${orphanedDocs.length} orphaned schedule entries`);
    return orphanedDocs.length;
  } catch (err) {
    console.error(`Error cleaning up orphaned schedules:`, err);
    throw err;
  }
}
