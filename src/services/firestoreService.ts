import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, type Unsubscribe,
  writeBatch, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';

// ─── Leave Requests ────────────────────────────────────────────────

export async function fetchLeaveRequests() {
  try {
    const q = query(
      collection(db, 'leave_requests'),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error('fetchLeaveRequests:', err);
    return [];
  }
}

export function listenLeaveRequests(
  callback: (requests: any[]) => void,
  errorCallback?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'leave_requests'),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(requests);
  }, (error) => {
    console.error('listenLeaveRequests error:', error);
    errorCallback?.(error as Error);
  });
}

export async function insertLeaveRequest(data: {
  userId: string;
  type: string;
  date: string;
  reason?: string;
  userDisplayName?: string;
  userRole?: string;
}) {
  try {
    // Convert frontend types to backend types
    let backendType: 'day_off' | 'vacation' = 'day_off';
    if (data.type === 'paid_vacation' || data.type === 'vacation') {
      backendType = 'vacation';
    }

    const submitLeaveRequest = httpsCallable(functions, 'submitLeaveRequest');
    const result = await submitLeaveRequest({
      userId: data.userId,
      type: backendType,
      date: data.date,
      reason: data.reason || '',
    });
    return (result.data as any).id;
  } catch (err) {
    console.error('insertLeaveRequest:', err);
    throw err;
  }
}

export async function updateLeaveRequestDb(
  id: string,
  updates: Record<string, unknown>
) {
  try {
    const docRef = doc(db, 'leave_requests', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (err) {
    console.error('updateLeaveRequestDb:', err);
  }
}

export async function cancelLeaveRequest(requestId: string) {
  try {
    const cancelRequest = httpsCallable(functions, 'cancelLeaveRequest');
    await cancelRequest({ requestId });
  } catch (err) {
    console.error('cancelLeaveRequest:', err);
    throw err;
  }
}

export async function approveLeaveRequest(
  requestId: string,
  note?: string
) {
  try {
    const decideRequest = httpsCallable(functions, 'decideLeaveRequest');
    await decideRequest({
      requestId,
      decision: 'approved',
      note: note || '',
    });
  } catch (err) {
    console.error('approveLeaveRequest:', err);
    throw err;
  }
}

export async function rejectLeaveRequest(
  requestId: string,
  note?: string
) {
  try {
    const decideRequest = httpsCallable(functions, 'decideLeaveRequest');
    await decideRequest({
      requestId,
      decision: 'rejected',
      note: note || '',
    });
  } catch (err) {
    console.error('rejectLeaveRequest:', err);
    throw err;
  }
}

// ─── Notifications ────────────────────────────────────────────────

export async function fetchNotifications(userId: string) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error('fetchNotifications:', err);
    return [];
  }
}

export function listenNotifications(
  userId: string,
  callback: (notifications: any[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(notifications);
  });
}

export async function markNotificationRead(notificationId: string) {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (err) {
    console.error('markNotificationRead:', err);
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  } catch (err) {
    console.error('markAllNotificationsRead:', err);
  }
}

export async function insertNotification(data: {
  id?: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  try {
    const notificationsRef = collection(db, 'notifications');
    const docRef = data.id ? doc(notificationsRef, data.id) : doc(notificationsRef);
    await setDoc(docRef, {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      data: data.data,
      read: false,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('insertNotification:', err);
    throw err;
  }
}

// ─── Audit Log ────────────────────────────────────────────────

export async function insertAuditLog(data: {
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  reason?: string;
  performedBy?: string;
  actorId?: string;
  actorName?: string;
  description?: string;
}) {
  try {
    const auditRef = collection(db, 'audit_log');
    const docRef = doc(auditRef);
    await setDoc(docRef, {
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      changes: data.changes,
      reason: data.reason,
      performedBy: data.performedBy || data.actorId,
      actor: {
        id: data.actorId,
        name: data.actorName,
      },
      description: data.description,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('insertAuditLog:', err);
  }
}

export async function fetchAuditLog() {
  try {
    const q = query(
      collection(db, 'audit_log'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error('fetchAuditLog:', err);
    return [];
  }
}

// ─── Swaps ────────────────────────────────────────────────

export async function fetchSwaps() {
  try {
    const q = query(
      collection(db, 'swaps'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error('fetchSwaps:', err);
    return [];
  }
}

export async function insertSwap(data: {
  proposerId: string;
  receiverId: string;
  proposerDate: string;
  receiverDate: string;
}) {
  try {
    const swapsRef = collection(db, 'swaps');
    const docRef = doc(swapsRef);
    await setDoc(docRef, {
      ...data,
      status: 'pending',
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('insertSwap:', err);
    throw err;
  }
}

export async function acceptSwap(swapId: string) {
  try {
    const acceptSwapFn = httpsCallable(functions, 'acceptSwap');
    await acceptSwapFn({ swapId });
  } catch (err) {
    console.error('acceptSwap:', err);
    throw err;
  }
}

export async function rejectSwap(swapId: string) {
  try {
    const docRef = doc(db, 'swaps', swapId);
    await updateDoc(docRef, { status: 'rejected' });
  } catch (err) {
    console.error('rejectSwap:', err);
  }
}

// ─── Balance ────────────────────────────────────────────────

export async function calculateUserBalance(userId: string) {
  try {
    const calculateBalance = httpsCallable(functions, 'calculateUserBalance');
    const result = await calculateBalance({ userId });
    return result.data;
  } catch (err) {
    console.error('calculateUserBalance:', err);
    throw err;
  }
}

export async function adjustVacationBalance(
  userId: string,
  adjustment: number,
  reason: string
) {
  try {
    const adjustBalance = httpsCallable(functions, 'adjustVacationBalance');
    const result = await adjustBalance({ userId, adjustment, reason });
    return result.data;
  } catch (err) {
    console.error('adjustVacationBalance:', err);
    throw err;
  }
}

// ─── Push Subscriptions ────────────────────────────────────────────────

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription
) {
  try {
    const subsRef = collection(db, 'push_subscriptions');
    const docRef = doc(subsRef);
    await setDoc(docRef, {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.getKey?.('p256dh'),
      auth: subscription.getKey?.('auth'),
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('savePushSubscription:', err);
  }
}

export async function removePushSubscription(subscriptionId: string) {
  try {
    const docRef = doc(db, 'push_subscriptions', subscriptionId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('removePushSubscription:', err);
  }
}

// ─── Tasks ────────────────────────────────────────────────

export async function fetchTasks(userId?: string) {
  try {
    let q;
    if (userId) {
      q = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', userId),
        orderBy('dueDate', 'asc')
      );
    } else {
      q = query(
        collection(db, 'tasks'),
        orderBy('dueDate', 'asc')
      );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error('fetchTasks:', err);
    return [];
  }
}

export async function insertTask(data: {
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  priority?: string;
  status?: string;
  createdBy: string;
}) {
  try {
    const tasksRef = collection(db, 'tasks');
    const docRef = doc(tasksRef);
    await setDoc(docRef, {
      ...data,
      status: data.status || 'pending',
      priority: data.priority || 'normal',
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('insertTask:', err);
    throw err;
  }
}

export async function updateTask(
  taskId: string,
  updates: Record<string, unknown>
) {
  try {
    const docRef = doc(db, 'tasks', taskId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (err) {
    console.error('updateTask:', err);
  }
}

export async function deleteTask(taskId: string) {
  try {
    const docRef = doc(db, 'tasks', taskId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('deleteTask:', err);
  }
}

// ─── Check-ins ────────────────────────────────────────────────

export async function recordCheckIn(data: {
  userId: string;
  timestamp: string;
  location?: string;
  type: 'check_in' | 'check_out';
}) {
  try {
    const checkInsRef = collection(db, 'check_ins');
    const docRef = doc(checkInsRef);
    await setDoc(docRef, {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('recordCheckIn:', err);
    throw err;
  }
}

export async function fetchCheckIns(userId: string, date: string) {
  try {
    const q = query(
      collection(db, 'check_ins'),
      where('userId', '==', userId),
      where('timestamp', '>=', `${date}T00:00:00`),
      where('timestamp', '<=', `${date}T23:59:59`),
      orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error('fetchCheckIns:', err);
    return [];
  }
}

// ─── Schedules ────────────────────────────────────────────────

export async function fetchSchedules(month?: number, year?: number) {
  try {
    let q;
    if (month && year) {
      q = query(
        collection(db, 'schedules'),
        where('month', '==', month),
        where('year', '==', year)
      );
    } else {
      q = query(collection(db, 'schedules'));
    }
    const snapshot = await getDocs(q);
    const result = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Sort client-side instead of relying on Firestore index
    result.sort((a: any, b: any) => a.date.localeCompare(b.date));
    console.log(`✓ fetchSchedules: Retrieved ${result.length} schedules${month && year ? ` for ${month}/${year}` : ''}`);
    return result;
  } catch (err) {
    console.error('✗ fetchSchedules error:', err);
    console.log('Note: Firestore query failed - may be missing index or permission issue');
    return [];
  }
}

export async function fetchSchedulesByDate(date: string) {
  try {
    const q = query(
      collection(db, 'schedules'),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    const result = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Sort client-side
    result.sort((a: any, b: any) => a.guide.localeCompare(b.guide));
    return result;
  } catch (err) {
    console.error('fetchSchedulesByDate:', err);
    return [];
  }
}

export async function insertSchedule(data: {
  date: string;
  dayOfWeek: string;
  guide: string;
  month: number;
  year: number;
}) {
  try {
    const schedulesRef = collection(db, 'schedules');
    const docRef = doc(schedulesRef);
    await setDoc(docRef, {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('insertSchedule:', err);
    throw err;
  }
}

export async function insertSchedulesBatch(schedules: Array<{
  date: string;
  dayOfWeek: string;
  guide: string;
  month: number;
  year: number;
}>) {
  try {
    console.log(`insertSchedulesBatch: Attempting to insert ${schedules.length} schedules...`);

    if (!schedules || schedules.length === 0) {
      console.warn('insertSchedulesBatch: No schedules to insert');
      return false;
    }

    const batch = writeBatch(db);
    const schedulesRef = collection(db, 'schedules');

    for (const schedule of schedules) {
      const docRef = doc(schedulesRef);
      batch.set(docRef, {
        ...schedule,
        createdAt: Timestamp.now(),
      });
    }

    await batch.commit();
    console.log(`✓ insertSchedulesBatch: Successfully inserted ${schedules.length} schedules`);
    return true;
  } catch (err) {
    console.error('✗ insertSchedulesBatch: Failed to insert:', err);
    if (err instanceof Error) {
      console.error('Error message:', err.message);
      console.error('Error code:', (err as any).code);
    }
    throw err;
  }
}

export async function deleteSchedule(scheduleId: string) {
  try {
    const docRef = doc(db, 'schedules', scheduleId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('deleteSchedule:', err);
  }
}

export async function clearSchedules() {
  try {
    const q = query(collection(db, 'schedules'));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (err) {
    console.error('clearSchedules:', err);
  }
}
