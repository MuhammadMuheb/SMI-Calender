import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch,
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
  console.log(`\n[Firestore Delete] Starting deletion for user: ${id}`);

  try {
    // Step 1: Fetch and validate user exists
    console.log(`[Firestore Delete] Fetching user record...`);
    const users = await fetchUsers();
    const user = users.find((u) => u.id === id);

    if (!user) {
      throw new Error(`User with ID "${id}" not found in Firestore`);
    }

    if (!user.username) {
      throw new Error(`User record exists but has no username - cannot delete. ID: ${id}`);
    }

    console.log(`[Firestore Delete] ✓ Found user: ${user.displayName} (username: ${user.username})`);

    // Step 2: Construct and validate document reference
    const docId = user.username.toLowerCase();
    const userRef = doc(db, 'users', docId);
    console.log(`[Firestore Delete] Document reference: users/${docId}`);

    // Step 3: Delete the document using batch
    console.log(`[Firestore Delete] Executing deletion...`);
    const batch = writeBatch(db);
    batch.delete(userRef);
    await batch.commit();
    console.log(`[Firestore Delete] ✓ Batch delete committed`);

    // Step 4: Verify deletion with retries for Firestore consistency
    console.log(`[Firestore Delete] Verifying deletion (with retries for consistency)...`);
    let verified = false;
    let retryCount = 0;
    const maxRetries = 4;
    const retryDelays = [1000, 2000, 3000, 4000];

    while (retryCount < maxRetries && !verified) {
      const delayMs = retryDelays[retryCount];
      console.log(`[Firestore Delete] → Retry ${retryCount + 1}/${maxRetries}: Waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      const freshUsers = await fetchUsers();
      const stillExists = freshUsers.some(u => u.id === id);

      if (!stillExists) {
        verified = true;
        console.log(`[Firestore Delete] ✓ Verified: User removed successfully (retry ${retryCount + 1})`);
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`[Firestore Delete] User still exists, retrying...`);
        }
      }
    }

    if (!verified) {
      const stillExistsUser = (await fetchUsers()).find(u => u.id === id);
      console.error(`[Firestore Delete] ✗ VERIFICATION FAILED after ${maxRetries} retries`);
      console.error(`[Firestore Delete] ID: ${id}, username: ${stillExistsUser?.username}`);
      throw new Error(`Deletion could not be verified: user "${user.displayName}" still exists after ${maxRetries} retries`);
    }

    console.log(`[Firestore Delete] ✓✓✓ DELETION COMPLETE - User fully removed from Firestore\n`);

  } catch (err) {
    console.error(`[Firestore Delete] ✗✗✗ DELETION FAILED\n`);
    console.error(`[Firestore Delete] Error message: ${(err as any)?.message || String(err)}`);
    console.error(`[Firestore Delete] Error code: ${(err as any)?.code || 'N/A'}`);

    if ((err as any)?.message?.includes('PERMISSION_DENIED')) {
      console.error(`[Firestore Delete] ⚠️  SECURITY RULES ISSUE DETECTED`);
      console.error(`[Firestore Delete] The Firestore security rules may be blocking deletion.`);
      console.error(`[Firestore Delete] Action: Deploy latest rules with: firebase deploy --only firestore:rules`);
    }

    throw err;
  }
}
