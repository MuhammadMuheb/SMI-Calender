import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StaffUser } from '../models/user';
import type { Role } from '../config/roles';

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
  try {
    const users = await fetchUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return;

    const mapped: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if ('displayName' in updates) mapped.displayName = updates.displayName;
    if ('role' in updates) mapped.role = updates.role;
    if ('isActive' in updates) mapped.isActive = updates.isActive;
    if ('pin' in updates) mapped.pinHash = updates.pin;
    if ('vacationOverride' in updates) mapped.vacationOverride = updates.vacationOverride;
    if ('vacationOverrideAt' in updates) mapped.vacationOverrideAt = updates.vacationOverrideAt;
    if ('regularOverride' in updates) mapped.regularOverride = updates.regularOverride;

    const userRef = doc(db, 'users', user.username.toLowerCase());
    await updateDoc(userRef, mapped);
  } catch (err) {
    console.error('updateUserDb:', err);
  }
}

export async function deleteUserDb(id: string): Promise<void> {
  try {
    const users = await fetchUsers();
    const user = users.find((u) => u.id === id);

    if (!user) {
      throw new Error(`User with ID "${id}" not found in Firestore`);
    }

    if (!user.username) {
      throw new Error(`User record exists but has no username - cannot delete. ID: ${id}`);
    }

    // Try to find document with either username format (instant, no logging)
    let docId = user.username.toLowerCase();
    let userRef = doc(db, 'users', docId);
    let docSnapshot = await getDoc(userRef);

    if (!docSnapshot.exists()) {
      docId = `usr_${user.username.toLowerCase()}`;
      userRef = doc(db, 'users', docId);
      docSnapshot = await getDoc(userRef);
    }

    if (!docSnapshot.exists()) {
      throw new Error(`Document not found: users/${docId}`);
    }

    // Delete immediately - no retries, no delays
    const batch = writeBatch(db);
    batch.delete(userRef);
    await batch.commit();
  } catch (err) {
    console.error(`[Firestore Delete] Error: ${(err as any)?.message || String(err)}`);
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
    const users = await fetchUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      throw new Error(`User with ID "${userId}" not found`);
    }

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

      // Delete in parallel for efficiency (CRITICAL: include schedules to prevent ghost entries)
      const [leaveCount, roleCount, checkinCount, tourCount, taskCount, scheduleCount] = await Promise.all([
        deleteUserLeaveRequests(userId),
        deleteUserRoleAssignments(userId),
        deleteUserCheckIns(userId),
        deleteUserTourAssignments(userId),
        deleteUserTasks(userId),
        deleteUserSchedules(userId),
      ]);

      deletedCounts.leaveRequests = leaveCount;
      deletedCounts.roleAssignments = roleCount;
      deletedCounts.checkIns = checkinCount;
      deletedCounts.tourAssignments = tourCount;
      deletedCounts.tasks = taskCount;
      deletedCounts.schedules = scheduleCount;

      console.log(`[HARD DELETE] Associated data purged:`);
      console.log(`  ✓ Leave requests: ${leaveCount}`);
      console.log(`  ✓ Role assignments: ${roleCount}`);
      console.log(`  ✓ Check-ins: ${checkinCount}`);
      console.log(`  ✓ Tour assignments: ${tourCount}`);
      console.log(`  ✓ Tasks unassigned: ${taskCount}`);
      console.log(`  ✓ Schedule entries: ${scheduleCount}`);

      // Finally, delete the user document
      console.log(`[HARD DELETE] Deleting user document...`);
      await deleteUserDb(userId);
      deletedCounts.user = 1;
      console.log(`  ✓ User document deleted`);

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✓ HARD DELETE COMPLETE`);
      console.log(`User "${user.displayName}" and ALL associated data permanently removed.`);
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
