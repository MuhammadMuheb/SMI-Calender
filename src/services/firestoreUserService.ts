import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StaffUser } from '../models/user';
import type { Role } from '../config/roles';

export async function fetchUsers(): Promise<StaffUser[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id as string,
        username: data.username as string,
        displayName: data.displayName as string,
        pin: data.pinHash as string,
        role: data.role as Role,
        isActive: data.isActive as boolean,
        createdAt: data.createdAt as string,
        updatedAt: data.updatedAt as string,
        vacationOverride: (data.vacationOverride as number | null) ?? null,
        vacationOverrideAt: (data.vacationOverrideAt as string | null) ?? null,
        regularOverride: (data.regularOverride as number | null) ?? null,
        jobRole: (data.jobRole ?? ['Office']) as string[],
      };
    });
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
    if (!user) return;

    const userRef = doc(db, 'users', user.username.toLowerCase());
    await deleteDoc(userRef);
  } catch (err) {
    console.error('deleteUserDb:', err);
  }
}
