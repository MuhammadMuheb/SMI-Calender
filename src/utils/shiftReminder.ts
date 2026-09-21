import { getDocs, collection, query, where, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Check if user should get a "time to check in" reminder
export async function checkShiftReminder(userId: string): Promise<boolean> {
  // Only remind between 6 AM and 10 AM
  const now = new Date();
  const hour = now.getHours();
  if (hour < 6 || hour > 10) return false;

  try {
    const q = query(
      collection(db, 'shift_reminders'),
      where('userId', '==', userId),
      where('date', '==', new Date().toISOString().split('T')[0])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.length > 0;
  } catch (error) {
    console.error('checkShiftReminder error:', error);
    return false;
  }
}

export async function scheduleShiftReminders(userId: string, date: string) {
  try {
    const reminderId = `${userId}_${date}`;
    await setDoc(doc(collection(db, 'shift_reminders'), reminderId), {
      userId,
      date,
      reminderTime: '06:00',
      createdAt: new Date().toISOString(),
      dismissed: false,
    });
  } catch (error) {
    console.error('scheduleShiftReminders error:', error);
  }
}

export async function getScheduledReminders(userId: string, startDate: string, endDate: string) {
  try {
    const q = query(
      collection(db, 'shift_reminders'),
      where('userId', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('getScheduledReminders error:', error);
    return [];
  }
}

export async function dismissReminder(reminderId: string) {
  try {
    await updateDoc(doc(collection(db, 'shift_reminders'), reminderId), {
      dismissed: true,
      dismissedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('dismissReminder error:', error);
  }
}

export async function updateReminderTime(reminderId: string, newTime: string) {
  try {
    await updateDoc(doc(collection(db, 'shift_reminders'), reminderId), {
      reminderTime: newTime,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('updateReminderTime error:', error);
  }
}
