import {
  collection, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CheckInData {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  locationId: string;
  locationName: string;
  checkInAt: string;
  checkOutAt: string | null;
  isWfh: boolean;
  workType: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  autoCheckedOut?: boolean;
}

/**
 * Start and end of a local calendar day (YYYY-MM-DD) as ISO (UTC) strings.
 * `checkInAt` is stored as an ISO UTC timestamp, so a local day in Italy
 * (UTC+1/+2) starts on the previous UTC day — never use `date + 'T00:00Z'`.
 */
export function localDayRange(date: string): [string, string] {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return [start.toISOString(), end.toISOString()];
}

/** Start and end of a local calendar month (month is 1–12) as ISO strings. */
export function localMonthRange(year: number, month: number): [string, string] {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return [start.toISOString(), end.toISOString()];
}

/** All check-ins with `checkInAt` in [startIso, endIso], newest first. Throws on failure. */
export async function fetchCheckInsBetween(startIso: string, endIso: string): Promise<CheckInData[]> {
  const q = query(
    collection(db, 'check_ins'),
    where('checkInAt', '>=', startIso),
    where('checkInAt', '<=', endIso),
    orderBy('checkInAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as CheckInData[];
}

/**
 * One user's check-ins with `checkInAt` in [startIso, endIso], newest first. Throws on failure.
 * Filters by date in memory so it only needs the single-field `userId` index.
 */
export async function fetchUserCheckInsBetween(userId: string, startIso: string, endIso: string): Promise<CheckInData[]> {
  const q = query(collection(db, 'check_ins'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return (snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CheckInData[])
    .filter(c => typeof c.checkInAt === 'string' && c.checkInAt >= startIso && c.checkInAt <= endIso)
    .sort((a, b) => b.checkInAt.localeCompare(a.checkInAt));
}

/** Check-ins that started on a local calendar day (YYYY-MM-DD). Returns [] on failure. */
export async function fetchCheckInsForDate(date: string) {
  try {
    const [startOfDay, endOfDay] = localDayRange(date);
    return await fetchCheckInsBetween(startOfDay, endOfDay);
  } catch (error) {
    console.error('fetchCheckInsForDate:', error);
    return [];
  }
}

export async function fetchRecentCheckIns(days = 7) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const q = query(
      collection(db, 'check_ins'),
      where('checkInAt', '>=', sinceStr),
      orderBy('checkInAt', 'desc'),
      limit(500)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as CheckInData[];
  } catch (error) {
    console.error('fetchRecentCheckIns:', error);
    return [];
  }
}

export async function fetchUserCheckIns(userId: string, limit_: number = 50) {
  try {
    const q = query(
      collection(db, 'check_ins'),
      where('userId', '==', userId),
      orderBy('checkInAt', 'desc'),
      limit(limit_)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as CheckInData[];
  } catch (error) {
    console.error('fetchUserCheckIns:', error);
    return [];
  }
}
