import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StaffingRule, StaffingEnforcement } from '@/models/staffing';

export async function fetchStaffingRules(): Promise<StaffingRule[]> {
  try {
    const snapshot = await getDocs(collection(db, 'staffing_rules'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id as string,
        jobRoleId: data.jobRoleId as string,
        dayOfWeek: (data.dayOfWeek as number | null) ?? null,
        minimumRequired: data.minimumRequired as number,
        enforcement: data.enforcement as StaffingEnforcement,
        createdAt: data.createdAt as string,
        updatedAt: data.updatedAt as string,
      };
    });
  } catch (err) {
    console.error('fetchStaffingRules:', err);
    return [];
  }
}

export async function insertStaffingRule(rule: {
  id: string;
  jobRoleId: string;
  dayOfWeek: number | null;
  minimumRequired: number;
  enforcement: string;
}): Promise<string> {
  try {
    const ruleRef = doc(db, 'staffing_rules', rule.id);
    await setDoc(ruleRef, {
      id: rule.id,
      jobRoleId: rule.jobRoleId,
      dayOfWeek: rule.dayOfWeek,
      minimumRequired: rule.minimumRequired,
      enforcement: rule.enforcement,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return rule.id;
  } catch (err) {
    console.error('insertStaffingRule ERROR:', err);
    throw err;
  }
}

export async function updateStaffingRuleDb(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  try {
    const mapped: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if ('enforcement' in updates) mapped.enforcement = updates.enforcement;
    if ('minimumRequired' in updates) mapped.minimumRequired = updates.minimumRequired;

    const ruleRef = doc(db, 'staffing_rules', id);
    await updateDoc(ruleRef, mapped);
  } catch (err) {
    console.error('updateStaffingRule:', err);
  }
}

export async function deleteStaffingRuleDb(id: string): Promise<void> {
  try {
    const ruleRef = doc(db, 'staffing_rules', id);
    await deleteDoc(ruleRef);
  } catch (err) {
    console.error('deleteStaffingRule:', err);
  }
}
