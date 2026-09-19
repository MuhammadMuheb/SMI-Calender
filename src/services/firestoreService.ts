import { getFirestore, collection, getDocs, addDoc, writeBatch, doc, setDoc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import type { TourAssignment } from '../models/tourAssignment';
import type { Schedule } from '../models/schedule';

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
        tourId: (data.tourId ?? '') as string,
        assignedDate: (data.assignedDate ?? '') as string,
      } as TourAssignment;
    });
  } catch (error) {
    console.error('Error fetching tour assignments:', error);
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
      return {
        id: docSnap.id,
        date: (data.date ?? '') as string,
        staffUserId: (data.staffUserId ?? '') as string,
        jobRoleId: (data.jobRoleId ?? '') as string,
        shiftStartTime: (data.shiftStartTime ?? '') as string,
        shiftEndTime: (data.shiftEndTime ?? '') as string,
        notes: (data.notes ?? '') as string,
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
    const docRef = await addDoc(collection(db, 'leave_requests'), {
      ...request,
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
  }
}

/**
 * Approve leave request
 */
export async function approveLeaveRequest(id: string, approvedBy: string): Promise<void> {
  try {
    const docRef = doc(db, 'leave_requests', id);
    await updateDoc(docRef, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error approving leave request:', error);
  }
}

/**
 * Reject leave request
 */
export async function rejectLeaveRequest(id: string, rejectedBy: string, reason?: string): Promise<void> {
  try {
    const docRef = doc(db, 'leave_requests', id);
    await updateDoc(docRef, {
      status: 'rejected',
      rejectedBy,
      rejectReason: reason || '',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error rejecting leave request:', error);
  }
}

/**
 * Listen to leave requests changes
 */
export function listenLeaveRequests(callback: (requests: any[]) => void) {
  try {
    const q = query(collection(db, 'leave_requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(requests);
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
