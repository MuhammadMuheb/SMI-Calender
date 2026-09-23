import { validateLeaveRequests } from '@/utils/dataValidation';
import { serverApi } from '@/lib/serverApi';
import { auth } from '@/lib/firebase';
import type { LeaveRequest } from '@/models/leave';
import { getFirestore, collection, getDocs, addDoc, writeBatch, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import type { TourAssignment } from '@/models/tourAssignment';
import type { Schedule } from '@/models/schedule';

const db = getFirestore();

/**
 * Fetch all tour assignments
 */
export async function fetchTourAssignments(): Promise<TourAssignment[]> {
  try {
    const snapshot = await getDocs(collection(db, 'tour_assignments'));
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: (data.userId ?? '') as string,
        date: (data.date ?? data.assignedDate ?? '') as string,
        source: (data.source ?? 'manual') as string,
        note: (data.note ?? '') as string,
        createdAt: (data.createdAt ?? new Date().toISOString()) as string,
      } as TourAssignment;
    });
  } catch (error) {
    console.error('Error fetching tour assignments:', error);
    return [];
  }
}

/**
 * Fetch audit log entries
 */
export async function fetchAuditLog(limit_: number = 500) {
  try {
    const q = query(collection(db, 'audit_log'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .slice(0, limit_)
      .map(docSnap => ({
        id: docSnap.id,
        actorId: docSnap.data().actorId ?? 'unknown',
        actorName: docSnap.data().actorName ?? 'Unknown',
        action: docSnap.data().action ?? '',
        entityType: docSnap.data().entityType ?? '',
        entityId: docSnap.data().entityId ?? '',
        description: docSnap.data().description ?? '',
        createdAt: docSnap.data().createdAt ?? new Date().toISOString(),
      }));
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return [];
  }
}

/**
 * Insert audit log entry
 */
export async function insertAuditLog(entry: {
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
}) {
  try {
    await addDoc(collection(db, 'audit_log'), {
      ...entry,
      actorId: auth.currentUser?.uid ?? '',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error inserting audit log:', error);
  }
}

/**
 * Fetch all schedules
 */
export async function fetchSchedules(): Promise<Schedule[]> {
  try {
    const snapshot = await getDocs(collection(db, 'schedules'));
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const dateStr = (data.date ?? '') as string;
      const date = new Date(dateStr + 'T00:00:00');
      return {
        id: docSnap.id,
        date: dateStr,
        dayOfWeek: (data.dayOfWeek ?? date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()) as string,
        guide: (data.guide ?? data.staffUserId ?? '') as string,
        month: (data.month ?? date.getMonth() + 1) as number,
        year: (data.year ?? date.getFullYear()) as number,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      } as Schedule;
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }
}

/**
 * Insert batch of schedules
 */
export async function insertSchedulesBatch(schedules: Schedule[]) {
  try {
    const batch = writeBatch(db);

    schedules.forEach((schedule) => {
      const docRef = doc(collection(db, 'schedules'));
      batch.set(docRef, {
        ...schedule,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error inserting schedules batch:', error);
    throw error;
  }
}

/**
 * Insert a new leave request
 */
export async function insertLeaveRequest(request: Omit<LeaveRequest, 'id'>): Promise<string> {
  return (await serverApi<{ id: string }>('leave', { action: 'create', data: request })).id;
}
export async function updateLeaveRequestDb(id: string, updates: Partial<LeaveRequest>): Promise<void> {
  await serverApi('leave', { action: 'update', id, data: updates });
}
export function cancelLeaveRequest(id: string): Promise<void> {
  return updateLeaveRequestDb(id, { status: 'cancelled' });
}
interface DecisionActor { id: string; displayName: string; role: string }
export function approveLeaveRequest(id: string, _actor: DecisionActor, note = ''): Promise<void> {
  return updateLeaveRequestDb(id, { status: 'approved', approverNote: note });
}
export function rejectLeaveRequest(id: string, _actor: DecisionActor, note = ''): Promise<void> {
  return updateLeaveRequestDb(id, { status: 'rejected', approverNote: note });
}

/**
 * Listen to leave requests changes
 */
export function listenLeaveRequests(
  callback: (requests: LeaveRequest[]) => void,
  onError?: (error: Error) => void,
) {
  try {
    const q = query(collection(db, 'leave_requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const requests = validateLeaveRequests(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
      callback(requests);
    }, (error) => {
      console.error('Leave request listener error:', error);
      onError?.(error);
    });
  } catch (error) {
    console.error('Error listening to leave requests:', error);
    return () => {};
  }
}

/**
 * Insert notification
 */
export async function insertNotification(notification: Record<string, unknown>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notification,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error inserting notification:', error);
    throw error;
  }
}

/**
 * Save push subscription
 */
export async function savePushSubscription(userId: string, subscription: Record<string, unknown>): Promise<void> {
  try {
    const docRef = doc(db, 'push_subscriptions', userId);
    await setDoc(docRef, {
      userId,
      ...subscription,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
  }
}
