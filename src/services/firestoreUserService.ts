import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StaffUser } from '../models/user';
import type { Role } from '../config/roles';

export async function fetchUsers(): Promise<StaffUser[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs
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
    console.log(`[Cascading Delete] Deleting role assignments for user: ${userId}`);
    const q = query(collection(db, 'role_assignments'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[Cascading Delete] No role assignments found for user: ${userId}`);
      return 0;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`[Cascading Delete] ✓ Deleted ${snapshot.size} role assignments for user: ${userId}`);
    return snapshot.size;
  } catch (err) {
    console.error(`[Cascading Delete] Error deleting role assignments:`, err);
    throw err;
  }
}

/**
 * Delete all leave requests for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserLeaveRequests(userId: string): Promise<number> {
  try {
    console.log(`[Cascading Delete] Deleting leave requests for user: ${userId}`);
    const q = query(collection(db, 'leave_requests'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[Cascading Delete] No leave requests found for user: ${userId}`);
      return 0;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`[Cascading Delete] ✓ Deleted ${snapshot.size} leave requests for user: ${userId}`);
    return snapshot.size;
  } catch (err) {
    console.error(`[Cascading Delete] Error deleting leave requests:`, err);
    throw err;
  }
}

/**
 * Delete all check-ins for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserCheckIns(userId: string): Promise<number> {
  try {
    console.log(`[Cascading Delete] Deleting check-ins for user: ${userId}`);
    const q = query(collection(db, 'check_ins'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[Cascading Delete] No check-ins found for user: ${userId}`);
      return 0;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`[Cascading Delete] ✓ Deleted ${snapshot.size} check-ins for user: ${userId}`);
    return snapshot.size;
  } catch (err) {
    console.error(`[Cascading Delete] Error deleting check-ins:`, err);
    throw err;
  }
}

/**
 * Delete all tour assignments for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserTourAssignments(userId: string): Promise<number> {
  try {
    console.log(`[Cascading Delete] Deleting tour assignments for user: ${userId}`);
    const q = query(collection(db, 'tour_assignments'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[Cascading Delete] No tour assignments found for user: ${userId}`);
      return 0;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`[Cascading Delete] ✓ Deleted ${snapshot.size} tour assignments for user: ${userId}`);
    return snapshot.size;
  } catch (err) {
    console.error(`[Cascading Delete] Error deleting tour assignments:`, err);
    throw err;
  }
}

/**
 * Delete all task assignments for a user
 * Called during user deletion to clean up dependent records
 */
export async function deleteUserTasks(userId: string): Promise<number> {
  try {
    console.log(`[Cascading Delete] Deleting task assignments for user: ${userId}`);
    const q = query(collection(db, 'tasks'), where('assignedTo', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[Cascading Delete] No task assignments found for user: ${userId}`);
      return 0;
    }

    // For tasks, we'll set assignedTo to null rather than delete (preserve audit trail)
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { assignedTo: null, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    console.log(`[Cascading Delete] ✓ Unassigned ${snapshot.size} tasks for user: ${userId}`);
    return snapshot.size;
  } catch (err) {
    console.error(`[Cascading Delete] Error updating task assignments:`, err);
    throw err;
  }
}
