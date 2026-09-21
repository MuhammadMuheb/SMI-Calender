import {
  collection, getDocs, query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

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

export async function fetchCheckInsForDate(date: string) {
  try {
    const startOfDay = date + 'T00:00:00.000Z';
    const endOfDay = date + 'T23:59:59.999Z';

    const q = query(
      collection(db, 'check_ins'),
      where('checkInAt', '>=', startOfDay),
      where('checkInAt', '<=', endOfDay),
      orderBy('checkInAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as CheckInData[];
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
