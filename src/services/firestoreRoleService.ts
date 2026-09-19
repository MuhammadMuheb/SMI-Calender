import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { JobRole, StaffRoleAssignment } from '../models/jobRole';

export async function fetchJobRoles(): Promise<JobRole[]> {
  try {
    const snapshot = await getDocs(collection(db, 'jobRoles'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id as string,
        name: data.name as string,
        color: data.color as string,
        isHidden: data.isHidden as boolean,
        shiftStartTime: data.shiftStart as string,
        shiftEndTime: data.shiftEnd as string,
        createdAt: data.createdAt as string,
        updatedAt: data.updatedAt as string,
      };
    });
  } catch (err) {
    console.error('fetchJobRoles:', err);
    return [];
  }
}

export async function insertJobRole(role: {
  id: string;
  name: string;
  color: string;
  isHidden: boolean;
  shiftStart: string;
  shiftEnd: string;
}): Promise<string> {
  try {
    const roleRef = doc(db, 'jobRoles', role.id);
    await setDoc(roleRef, {
      id: role.id,
      name: role.name,
      color: role.color,
      isHidden: role.isHidden,
      shiftStart: role.shiftStart,
      shiftEnd: role.shiftEnd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return role.id;
  } catch (err) {
    console.error('insertJobRole ERROR:', err);
    throw err;
  }
}

export async function updateJobRoleDb(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  try {
    const mapped: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if ('isHidden' in updates) mapped.isHidden = updates.isHidden;
    if ('name' in updates) mapped.name = updates.name;
    if ('color' in updates) mapped.color = updates.color;

    const roleRef = doc(db, 'jobRoles', id);
    await updateDoc(roleRef, mapped);
  } catch (err) {
    console.error('updateJobRole:', err);
  }
}

export async function deleteJobRoleDb(id: string): Promise<void> {
  try {
    const roleRef = doc(db, 'jobRoles', id);
    await deleteDoc(roleRef);
  } catch (err) {
    console.error('deleteJobRole:', err);
  }
}

export async function fetchRoleAssignments(): Promise<StaffRoleAssignment[]> {
  try {
    const snapshot = await getDocs(collection(db, 'roleAssignments'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id as string,
        userId: data.userId as string,
        jobRoleId: data.jobRoleId as string,
        isPrimary: data.isPrimary as boolean,
        assignedAt: data.assignedAt as string,
      };
    });
  } catch (err) {
    console.error('fetchRoleAssignments:', err);
    return [];
  }
}

export async function insertRoleAssignment(assignment: {
  id: string;
  userId: string;
  jobRoleId: string;
  isPrimary: boolean;
}): Promise<string> {
  try {
    const assignRef = doc(db, 'roleAssignments', assignment.id);
    await setDoc(assignRef, {
      id: assignment.id,
      userId: assignment.userId,
      jobRoleId: assignment.jobRoleId,
      isPrimary: assignment.isPrimary,
      assignedAt: new Date().toISOString(),
    });
    return assignment.id;
  } catch (err) {
    console.error('insertRoleAssignment ERROR:', err);
    throw err;
  }
}

export async function deleteRoleAssignmentDb(id: string): Promise<void> {
  try {
    const assignRef = doc(db, 'roleAssignments', id);
    await deleteDoc(assignRef);
  } catch (err) {
    console.error('deleteRoleAssignment:', err);
  }
}
