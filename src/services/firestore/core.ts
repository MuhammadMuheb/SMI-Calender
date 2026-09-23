import { getFirestore, collection, getDocs, addDoc, writeBatch, doc, setDoc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
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
export async function insertSchedulesBatch(schedules: any[]) {
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
  }
}

/**
 * Insert a new leave request
 */
export async function insertLeaveRequest(request: any): Promise<string> {
  try {
    // Never persist a client-side placeholder id — the Firestore doc id is the id.
    const payload = { ...(request ?? {}) };
    delete payload.id;
    const docRef = await addDoc(collection(db, 'leave_requests'), {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error inserting leave request:', error);
    throw error;
  }
}

/**
 * Update leave request
 */
export async function updateLeaveRequestDb(id: string, updates: any): Promise<void> {
  try {
    const docRef = doc(db, 'leave_requests', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating leave request:', error);
    throw error;
  }
}

/**
 * Cancel leave request
 */
export async function cancelLeaveRequest(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'leave_requests', id);
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    throw error;
  }
}

interface DecisionActor { id: string; displayName: string; role: string }

/**
 * Record an approve/reject decision on a leave request.
 */
async function decideLeaveRequest(
  id: string, status: 'approved' | 'rejected', decidedBy: DecisionActor, note: string,
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'leave_requests', id), {
    status,
    decidedBy: { id: decidedBy.id, displayName: decidedBy.displayName, role: decidedBy.role },
    decidedAt: now,
    approverNote: note,
    updatedAt: now,
  });
}

export function approveLeaveRequest(id: string, decidedBy: DecisionActor, note = ''): Promise<void> {
  return decideLeaveRequest(id, 'approved', decidedBy, note);
}

export function rejectLeaveRequest(id: string, decidedBy: DecisionActor, note = ''): Promise<void> {
  return decideLeaveRequest(id, 'rejected', decidedBy, note);
}

/**
 * Ensure LeaveRequest has safe userRef with displayName fallback
 */
function ensureSafeUserRef(data: any) {
  if (!data.userRef) {
    return { id: data.userId ?? 'unknown', displayName: data.user_display_name ?? 'Unknown', role: 'staff' };
  }
  return {
    id: data.userRef.id ?? data.userId ?? 'unknown',
    displayName: data.userRef.displayName ?? data.user_display_name ?? 'Unknown',
    role: data.userRef.role ?? 'staff',
  };
}

/**
 * Listen to leave requests changes
 */
export function listenLeaveRequests(
  callback: (requests: any[]) => void,
  onError?: (error: Error) => void,
) {
  try {
    const q = query(collection(db, 'leave_requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          // The document id always wins over any legacy `id` field stored in the doc.
          id: d.id,
          userRef: ensureSafeUserRef(data),
          decidedBy: data.decidedBy ? {
            id: data.decidedBy.id ?? 'unknown',
            displayName: data.decidedBy.displayName ?? 'Unknown',
            role: data.decidedBy.role ?? 'staff',
          } : null,
          overriddenBy: data.overriddenBy ? {
            id: data.overriddenBy.id ?? 'unknown',
            displayName: data.overriddenBy.displayName ?? 'Unknown',
            role: data.overriddenBy.role ?? 'staff',
          } : null,
        };
      });
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
export async function insertNotification(notification: any): Promise<string> {
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
export async function savePushSubscription(userId: string, subscription: any): Promise<void> {
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
