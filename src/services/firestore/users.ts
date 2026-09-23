import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, writeBatch, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
          pin: (data.pinHash ?? data.pin ?? '') as string,
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
  try {
    const userRef = doc(db, 'users', user.username.toLowerCase());
    await setDoc(userRef, {
      id: user.id,
      username: user.username.toLowerCase(),
      displayName: user.displayName,
      pinHash: user.pin,
      role: user.role,
      isActive: true,
      jobRole: [],
      vacationOverride: null,
      regularOverride: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return user.id;
  } catch (err) {
    console.error('insertUser ERROR:', err);
    throw err;
  }
}

export async function updateUserDb(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const mapped: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if ('displayName' in updates) mapped.displayName = updates.displayName;
  if ('role' in updates) mapped.role = updates.role;
  if ('isActive' in updates) mapped.isActive = updates.isActive;
  if ('pin' in updates) mapped.pinHash = updates.pin;
  if ('vacationOverride' in updates) mapped.vacationOverride = updates.vacationOverride;
  if ('vacationOverrideAt' in updates) mapped.vacationOverrideAt = updates.vacationOverrideAt;
  if ('regularOverride' in updates) mapped.regularOverride = updates.regularOverride;
  if ('jobRole' in updates) mapped.jobRole = updates.jobRole;

  // Some users exist as two documents (keyed by username and by id) that share
  // the same `id` field. Update every copy so reads stay consistent.
  const matches = await getDocs(query(collection(db, 'users'), where('id', '==', id)));
  const refs = matches.docs.map((d) => d.ref);
  if (refs.length === 0) {
    const direct = await getDoc(doc(db, 'users', id));
    if (!direct.exists()) throw new Error(`User ${id} not found`);
    refs.push(direct.ref);
  }
  const batch = writeBatch(db);
  refs.forEach((ref) => batch.update(ref, mapped));
  await batch.commit();
}

export async function deleteUserDb(id: string): Promise<void> {
  try {
    // CRITICAL FIX: Query Firestore directly to find user (bypasses fetchUsers filter)
    // This prevents "not found" errors when user is already inactive
    const userSnap = await getDocs(query(collection(db, 'users'), where('id', '==', id)));

    if (userSnap.empty) {
      throw new Error(`User with ID "${id}" not found in Firestore`);
    }

    const userData = userSnap.docs[0].data();
    const username = userData.username || userData.name;
    const actualDocId = userSnap.docs[0].id; // Use the actual document ID from query

    if (!username) {
      throw new Error(`User record exists but has no username - cannot delete. ID: ${id}`);
    }

    console.log(`[User Deletion] Found user: username="${username}", actualDocId="${actualDocId}", userId="${id}"`);

    // CRITICAL: Use actual document ID from query result - this is the most reliable method
    const userRef = doc(db, 'users', actualDocId);
    const docSnapshot = await getDoc(userRef);

    if (!docSnapshot.exists()) {
      // Document not found with actual ID, this should not happen if query succeeded
      throw new Error(`[CRITICAL] Query returned user but document not found: users/${actualDocId}`);
    }

    // Delete user document
    console.log(`[User Deletion] Deleting document: ${actualDocId}`);
    const batch = writeBatch(db);
    batch.delete(userRef);
    await batch.commit();

    // Verify deletion succeeded
    const verifySnap = await getDoc(userRef);
    if (verifySnap.exists()) {
      throw new Error(`[CRITICAL] User document still exists after deletion attempt: ${actualDocId}`);
    }

    console.log(`[User Deletion] ✓ User document successfully deleted: ${actualDocId}`);
  } catch (err) {
    console.error(`[Firestore Delete] CRITICAL ERROR: ${(err as any)?.message || String(err)}`);
    throw err;
  }
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
    return 0;
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
    return 0;
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
    return 0;
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
    return 0;
  }
}

/**
 * Delete all task assignments for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserTasks(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'tasks'), where('assignedTo', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { assignedTo: null, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    return snapshot.size;
  } catch (err) {
    console.error(`Error updating task assignments:`, err);
    return 0;
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

    const user = userSnap.docs[0].data() as any;
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
    return 0;
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
  try {
    // CRITICAL FIX: Query Firestore directly to find user (not fetchUsers which filters inactive)
    // This prevents "not found" errors when attempting to delete already-inactive users
    const userSnap = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));

    if (userSnap.empty) {
      throw new Error(`User with ID "${userId}" not found in Firestore`);
    }

    const userData = userSnap.docs[0].data() as any;
    const user = {
      id: userData.id || userSnap.docs[0].id,
      username: userData.username || userData.name || userSnap.docs[0].id,
      displayName: userData.displayName || userData.name || userData.username || userSnap.docs[0].id,
      isActive: userData.isActive !== false,
    } as any;

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
        throw new Error(`Cascade deletion failed: ${(cascadeErr as any)?.message}`);
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

      const userRef = doc(db, 'users', user.username.toLowerCase());
      await updateDoc(userRef, {
        isActive: false,
        updatedAt: new Date().toISOString(),
      });

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
    console.error(`Error: ${(err as any)?.message || String(err)}`);
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
    const orphanedDocs: any[] = [];

    schedules.docs.forEach(doc => {
      const guide = (doc.data().guide || '').toLowerCase();
      if (guide && !validUserNames.has(guide)) {
        orphanedDocs.push(doc.ref);
      }
    });

    if (orphanedDocs.length === 0) return 0;

    // Delete in batches to respect Firestore limits
    let batch = writeBatch(db);
    let batchCount = 0;

    orphanedDocs.forEach((docRef, idx) => {
      batch.delete(docRef);
      batchCount++;

      // Commit every 500 deletions
      if (batchCount === 500 || idx === orphanedDocs.length - 1) {
        batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    });

    console.log(`[Orphan Cleanup] Deleted ${orphanedDocs.length} orphaned schedule entries`);
    return orphanedDocs.length;
  } catch (err) {
    console.error(`Error cleaning up orphaned schedules:`, err);
    return 0;
  }
}
