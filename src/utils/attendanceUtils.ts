import { fetchCheckInsForDate, fetchRecentCheckIns } from '../services/firestoreCheckInsService';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const BREAK_MINUTES: Record<string, number> = { 'Check In': 60, 'Back Office': 30, 'Back Office Extra': 30, 'Office': 30 };

function getBreak(roles: string[]): number {
  let max = 30;
  for (const r of roles) { if (BREAK_MINUTES[r] && BREAK_MINUTES[r] > max) max = BREAK_MINUTES[r]; }
  return max;
}

// ─── EXPORT ATTENDANCE TO CSV ─────────────────────────────
export async function exportAttendanceCSV(year: number, month: number): Promise<string | null> {
  try {
    const checkIns = await fetchRecentCheckIns(90);

    if (checkIns.length === 0) return null;

    // Filter by month and year
    const filtered = checkIns.filter(c => {
      const date = new Date(c.checkInAt);
      return date.getFullYear() === year && date.getMonth() === month;
    });

    // Build CSV
    const headers = ['User', 'Date', 'Check-In', 'Check-Out', 'Duration', 'Location'];
    const rows = filtered.map(c => {
      const checkInDate = new Date(c.checkInAt);
      const checkOutDate = c.checkOutAt ? new Date(c.checkOutAt) : null;
      const duration = checkOutDate ? `${Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 3600000)} hrs` : 'Ongoing';
      return [
        c.userName,
        checkInDate.toLocaleDateString(),
        checkInDate.toLocaleTimeString(),
        c.checkOutAt ? new Date(c.checkOutAt).toLocaleTimeString() : 'N/A',
        duration,
        c.locationName
      ];
    });

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    return csv;
  } catch (error) {
    console.error('exportAttendanceCSV error:', error);
    return null;
  }
}

export async function generateMonthlySchedule(year: number, month: number) {
  try {
    const q = query(
      collection(db, 'schedules'),
      where('date', '>=', `${year}-${String(month + 1).padStart(2, '0')}-01`)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error('generateMonthlySchedule error:', error);
    return [];
  }
}

export async function getWorkersForDate(date: string) {
  try {
    const checkIns = await fetchCheckInsForDate(date);
    return Array.from(new Set(checkIns.map(c => c.userId)));
  } catch (error) {
    console.error('getWorkersForDate error:', error);
    return [];
  }
}

export async function recordAutoCheckout(checkInId: string, newCheckoutTime: string) {
  try {
    const checkInRef = collection(db, 'check_ins');
    const q = query(checkInRef, where('id', '==', checkInId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      ...data,
      checkOutAt: newCheckoutTime,
      autoCheckedOut: true,
    };
  } catch (error) {
    console.error('recordAutoCheckout error:', error);
    return null;
  }
}

export async function fixMissingCheckout(checkInId: string, checkoutTime: string) {
  try {
    const checkInRef = collection(db, 'check_ins');
    const q = query(checkInRef, where('id', '==', checkInId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      checkOutAt: checkoutTime,
      fixedMissingCheckout: true,
    };
  } catch (error) {
    console.error('fixMissingCheckout error:', error);
    return null;
  }
}

export async function sendLateAlerts(date: string) {
  try {
    const checkIns = await fetchCheckInsForDate(date);
    const late = checkIns.filter(c => {
      const time = new Date(c.checkInAt);
      return time.getHours() >= 9; // After 9 AM is late
    });
    return late.length;
  } catch (error) {
    console.error('sendLateAlerts error:', error);
    return 0;
  }
}

export async function sendCheckoutReminders(date: string) {
  try {
    const checkIns = await fetchCheckInsForDate(date);
    const noCheckout = checkIns.filter(c => !c.checkOutAt);
    return noCheckout.length;
  } catch (error) {
    console.error('sendCheckoutReminders error:', error);
    return 0;
  }
}
