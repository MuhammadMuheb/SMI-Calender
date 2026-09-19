import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Holiday, SpecialDay } from '../models/holiday';
import type { NotificationSettings } from '../models/notification';

// ─── Holidays ──────────────────────────────────────────────

export async function fetchHolidays(): Promise<Holiday[]> {
  try {
    const snapshot = await getDocs(collection(db, 'holidays'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id as string,
        name: data.name as string,
        date: (data.date as string).split('T')[0],
        isRecurring: data.isRecurring as boolean,
        createdAt: data.createdAt as string,
      };
    });
  } catch (err) {
    console.error('fetchHolidays:', err);
    return [];
  }
}

// ─── Special Days ──────────────────────────────────────────

export async function fetchSpecialDays(): Promise<SpecialDay[]> {
  try {
    const snapshot = await getDocs(collection(db, 'specialDays'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.id as string,
        name: data.name as string,
        date: (data.date as string).split('T')[0],
        consumesBalance: data.consumesBalance as boolean,
        appliesToAll: data.appliesToAll as boolean,
        appliesTo: (data.appliesTo ?? []) as string[],
        createdBy: data.createdBy as string,
        createdAt: data.createdAt as string,
      };
    });
  } catch (err) {
    console.error('fetchSpecialDays:', err);
    return [];
  }
}

export async function insertSpecialDay(day: {
  id: string;
  name: string;
  date: string;
  consumesBalance: boolean;
  appliesToAll: boolean;
  appliesTo: string[];
  createdBy: string;
}): Promise<string> {
  try {
    const dayRef = doc(db, 'specialDays', day.id);
    await setDoc(dayRef, {
      id: day.id,
      name: day.name,
      date: day.date,
      consumesBalance: day.consumesBalance,
      appliesToAll: day.appliesToAll,
      appliesTo: day.appliesTo,
      createdBy: day.createdBy,
      createdAt: new Date().toISOString(),
    });
    return day.id;
  } catch (err) {
    console.error('insertSpecialDay ERROR:', err);
    throw err;
  }
}

export async function deleteSpecialDayDb(id: string): Promise<void> {
  try {
    const dayRef = doc(db, 'specialDays', id);
    await deleteDoc(dayRef);
  } catch (err) {
    console.error('deleteSpecialDay:', err);
  }
}

// ─── Notification Settings ────────────────────────────────

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  try {
    const docSnap = await getDocs(collection(db, 'notificationSettings'));

    if (docSnap.empty) {
      return {
        dailyReminderTime: '14:00',
        dailyReminderEnabled: true,
        updatedAt: '',
        updatedBy: '',
      };
    }

    const data = docSnap.docs[0].data();
    return {
      dailyReminderTime: data.dailyReminderTime as string,
      dailyReminderEnabled: data.dailyReminderEnabled as boolean,
      updatedAt: data.updatedAt as string,
      updatedBy: data.updatedBy as string,
    };
  } catch (err) {
    console.error('fetchNotificationSettings:', err);
    return {
      dailyReminderTime: '14:00',
      dailyReminderEnabled: true,
      updatedAt: '',
      updatedBy: '',
    };
  }
}

export async function updateNotificationSettingsDb(updates: {
  dailyReminderTime?: string;
  dailyReminderEnabled?: boolean;
  updatedBy: string;
}): Promise<void> {
  try {
    const mapped: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updatedBy: updates.updatedBy,
    };
    if (updates.dailyReminderTime !== undefined) {
      mapped.dailyReminderTime = updates.dailyReminderTime;
    }
    if (updates.dailyReminderEnabled !== undefined) {
      mapped.dailyReminderEnabled = updates.dailyReminderEnabled;
    }

    const settingsRef = doc(db, 'notificationSettings', 'global');
    await updateDoc(settingsRef, mapped);
  } catch (err) {
    console.error('updateNotificationSettings:', err);
  }
}
