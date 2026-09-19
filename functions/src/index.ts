import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as bcrypt from 'bcryptjs';

initializeApp();

interface UserDoc {
  id: string;
  username: string;
  displayName: string;
  pinHash: string;
  role: 'staff' | 'manager' | 'super_admin' | 'spectator';
  jobRole?: string[];
  isActive: boolean;
}

interface LeaveRequestDoc {
  id: string;
  userId: string;
  type: 'day_off' | 'vacation';
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  approvedBy?: string;
  approvedAt?: FieldValue;
  createdAt: FieldValue;
}


// ============ Authentication ============

/**
 * Verifies a username + PIN and returns a Firebase Auth custom token.
 */
export const signInWithPin = onCall<{ username: string; pin: string }>(
  { region: 'us-central1' },
  async (request) => {
    const username = request.data.username?.trim().toLowerCase();
    const pin = request.data.pin;

    if (!username || !pin) {
      throw new HttpsError('invalid-argument', 'Username and PIN are required');
    }

    const db = getFirestore();
    const snap = await db.collection('users').doc(username).get();

    const invalidCredentials = () => new HttpsError('unauthenticated', 'Invalid username or PIN');

    if (!snap.exists) throw invalidCredentials();
    const user = snap.data() as UserDoc;

    if (!user.isActive) throw invalidCredentials();

    const pinMatches = await bcrypt.compare(pin, user.pinHash);
    if (!pinMatches) throw invalidCredentials();

    const token = await getAuth().createCustomToken(user.id, { role: user.role });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        jobRole: user.jobRole ?? [],
      },
    };
  },
);

// ============ SMI Calculator Functions ============

/**
 * Calculates current balance for a user based on their leave requests and accrual rules.
 * - Regular days: 6 per 28-day cycle
 * - Vacation: 2 days accrued per month, cumulative (rolls over)
 * - First Sunday auto-off: consumes 1 regular day
 */
export const calculateUserBalance = onCall<{ userId: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { userId } = request.data;

    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId is required');
    }

    const db = getFirestore();

    // Get user
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    // Get all leave requests for this user
    const requestsSnap = await db
      .collection('leave_requests')
      .where('userId', '==', userId)
      .where('status', '==', 'approved')
      .get();

    const requests = requestsSnap.docs.map((doc) => doc.data() as LeaveRequestDoc);

    // Count by type
    const regularDaysUsed = requests.filter((r) => r.type === 'day_off').length;
    const vacationDaysUsed = requests.filter((r) => r.type === 'vacation').length;

    // Calculate vacation balance (2 per month, cumulative, no hard cap)
    const monthsSinceStart = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 30));
    const vacationBalance = monthsSinceStart * 2 - vacationDaysUsed;

    // Current cycle (28-day)
    const cycleIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 28));
    const regularDaysAvailable = 6 - regularDaysUsed;

    return {
      userId,
      cycleIndex,
      regularDaysUsed,
      regularDaysAvailable,
      vacationDaysUsed,
      vacationBalance,
      vacationBalanceAvailable: Math.max(0, vacationBalance),
    };
  },
);

/**
 * Calculates total monthly payment for all staff based on worked days and rates.
 * - Base: works every day except approved time off
 * - Deductions: for unpaid leave (day_off consumes 1 day each, vacation consumes 1 day each)
 */
export const calculateMonthlyPayment = onCall<{ year: number; month: number }>(
  { region: 'us-central1' },
  async (request) => {
    const { year, month } = request.data;

    if (!year || !month || month < 1 || month > 12) {
      throw new HttpsError('invalid-argument', 'Valid year and month required');
    }

    const db = getFirestore();

    // Get all active staff
    const usersSnap = await db
      .collection('users')
      .where('role', '==', 'staff')
      .where('isActive', '==', true)
      .get();

    const staffMembers = usersSnap.docs.map((doc) => doc.data() as UserDoc);

    // Get all approved leave for this month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const leaveSnap = await db
      .collection('leave_requests')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .where('status', '==', 'approved')
      .get();

    const leaveByUser = new Map<string, number>();
    leaveSnap.docs.forEach((doc) => {
      const leave = doc.data() as LeaveRequestDoc;
      leaveByUser.set(leave.userId, (leaveByUser.get(leave.userId) ?? 0) + 1);
    });

    // Calculate payments
    const workingDaysInMonth = 22; // Average
    const dailyRate = 50; // EUR (example)

    const staffPayments = staffMembers.map((staff) => {
      const daysOff = leaveByUser.get(staff.id) ?? 0;
      const workedDays = workingDaysInMonth - daysOff;
      const payment = workedDays * dailyRate;

      return {
        staffId: staff.id,
        displayName: staff.displayName,
        workedDays,
        daysOff,
        dailyRate,
        totalPayment: payment,
      };
    });

    const totalPayment = staffPayments.reduce((sum, sp) => sum + sp.totalPayment, 0);

    return {
      year,
      month,
      totalPayment,
      staffCount: staffMembers.length,
      staffPayments,
    };
  },
);

// ============ Leave Request Operations ============

/**
 * Submits a new leave request (day off or vacation).
 * Validates balance and prevents duplicates.
 */
export const submitLeaveRequest = onCall<{
  userId: string;
  type: 'day_off' | 'vacation';
  date: string;
  reason?: string;
}>(
  { region: 'us-central1' },
  async (request) => {
    const { userId, type, date, reason } = request.data;

    if (!userId || !type || !date) {
      throw new HttpsError('invalid-argument', 'userId, type, and date required');
    }

    const db = getFirestore();

    // Check duplicate
    const existingSnap = await db
      .collection('leave_requests')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .where('status', 'in', ['pending', 'approved'])
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError('already-exists', 'Leave already exists for this date');
    }

    // Check balance
    const requestsSnap = await db
      .collection('leave_requests')
      .where('userId', '==', userId)
      .where('status', '==', 'approved')
      .get();

    const requests = requestsSnap.docs.map((doc) => doc.data() as LeaveRequestDoc);
    const regularDaysUsed = requests.filter((r) => r.type === 'day_off').length;
    const vacationDaysUsed = requests.filter((r) => r.type === 'vacation').length;
    const monthsSinceStart = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 30));
    const vacationBalance = monthsSinceStart * 2 - vacationDaysUsed;

    if (type === 'day_off' && regularDaysUsed >= 6) {
      throw new HttpsError('failed-precondition', 'No regular days available');
    }
    if (type === 'vacation' && vacationBalance <= 0) {
      throw new HttpsError('failed-precondition', 'No vacation days available');
    }

    // Create request
    const docRef = db.collection('leave_requests').doc();
    await docRef.set({
      id: docRef.id,
      userId,
      type,
      date,
      status: 'pending',
      reason: reason || '',
      createdAt: Timestamp.now(),
    });

    return {
      id: docRef.id,
      userId,
      type,
      date,
      status: 'pending',
    };
  },
);

/**
 * Manager/Admin approves or rejects a leave request.
 * Only super_admin can approve manager requests.
 */
export const decideLeaveRequest = onCall<{
  requestId: string;
  decision: 'approved' | 'rejected';
  note?: string;
}>(
  { region: 'us-central1' },
  async (request) => {
    const { requestId, decision, note } = request.data;
    const approverId = request.auth?.uid;
    const approverRole = request.auth?.token?.role as string;

    if (!requestId || !decision) {
      throw new HttpsError('invalid-argument', 'requestId and decision required');
    }

    if (!approverId) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const db = getFirestore();

    const leaveRef = db.collection('leave_requests').doc(requestId);
    const leaveSnap = await leaveRef.get();

    if (!leaveSnap.exists) {
      throw new HttpsError('not-found', 'Leave request not found');
    }

    const leave = leaveSnap.data() as LeaveRequestDoc;

    // Get requester's role to enforce super_admin approval for manager requests
    const requesterSnap = await db.collection('users').doc(leave.userId).get();
    const requester = requesterSnap.data() as UserDoc;

    if (requester.role === 'manager' && approverRole !== 'super_admin') {
      throw new HttpsError(
        'permission-denied',
        'Only super_admin can approve manager requests'
      );
    }

    // Only manager+ can approve
    if (!['manager', 'super_admin'].includes(approverRole)) {
      throw new HttpsError('permission-denied', 'Only managers can approve requests');
    }

    await leaveRef.update({
      status: decision,
      approvedBy: approverId,
      approvalNote: note || '',
      approvedAt: Timestamp.now(),
    });

    return { id: requestId, status: decision };
  },
);

/**
 * Staff cancels their pending leave request.
 */
export const cancelLeaveRequest = onCall<{ requestId: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { requestId } = request.data;
    const userId = request.auth?.uid;

    if (!requestId || !userId) {
      throw new HttpsError('invalid-argument', 'requestId required and must be logged in');
    }

    const db = getFirestore();

    const leaveRef = db.collection('leave_requests').doc(requestId);
    const leaveSnap = await leaveRef.get();

    if (!leaveSnap.exists) {
      throw new HttpsError('not-found', 'Leave request not found');
    }

    const leave = leaveSnap.data() as LeaveRequestDoc;
    if (leave.userId !== userId) {
      throw new HttpsError('permission-denied', 'Cannot cancel someone else\'s request');
    }

    if (leave.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Can only cancel pending requests');
    }

    await leaveRef.update({ status: 'cancelled' });

    return { id: requestId, status: 'cancelled' };
  },
);

// ============ Swap & Leave Integration ============

interface SwapRequest {
  id: string;
  proposerId: string;
  receiverId: string;
  proposerDate: string;
  receiverDate: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: FieldValue;
}

/**
 * When a swap is accepted, automatically:
 * 1. Create leave request for proposer's received date
 * 2. Create leave request for receiver's received date
 * 3. Cancel or modify original requests if needed
 */
export const acceptSwap = onCall<{ swapId: string }>(
  { region: 'us-central1' },
  async (request) => {
    const { swapId } = request.data;
    const receiverId = request.auth?.uid;

    if (!swapId || !receiverId) {
      throw new HttpsError('invalid-argument', 'swapId required and must be logged in');
    }

    const db = getFirestore();
    const batch = db.batch();

    // Get swap request
    const swapRef = db.collection('swaps').doc(swapId);
    const swapSnap = await swapRef.get();

    if (!swapSnap.exists) {
      throw new HttpsError('not-found', 'Swap not found');
    }

    const swap = swapSnap.data() as SwapRequest;

    if (swap.receiverId !== receiverId) {
      throw new HttpsError('permission-denied', 'Only receiver can accept swap');
    }

    if (swap.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Swap is not pending');
    }

    // Create leave request for proposer on proposer's original date (they get receiver's date off)
    const proposerLeaveRef = db.collection('leave_requests').doc();
    batch.set(proposerLeaveRef, {
      id: proposerLeaveRef.id,
      userId: swap.proposerId,
      type: 'day_off',
      date: swap.receiverDate,
      status: 'approved',
      reason: `Swapped with ${receiverId}`,
      approvedBy: 'system',
      approvedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    // Create leave request for receiver on receiver's original date (they get proposer's date off)
    const receiverLeaveRef = db.collection('leave_requests').doc();
    batch.set(receiverLeaveRef, {
      id: receiverLeaveRef.id,
      userId: swap.receiverId,
      type: 'day_off',
      date: swap.proposerDate,
      status: 'approved',
      reason: `Swapped with ${swap.proposerId}`,
      approvedBy: 'system',
      approvedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    // Mark swap as accepted
    batch.update(swapRef, { status: 'accepted' });

    await batch.commit();

    return {
      swapId,
      status: 'accepted',
      proposerLeave: proposerLeaveRef.id,
      receiverLeave: receiverLeaveRef.id,
    };
  },
);

/**
 * Adjusts vacation balance for a user (admin only).
 * Updates the user's vacation balance directly.
 */
export const adjustVacationBalance = onCall<{
  userId: string;
  adjustment: number;
  reason: string;
}>(
  { region: 'us-central1' },
  async (request) => {
    const { userId, adjustment, reason } = request.data;
    const adminId = request.auth?.uid;
    const adminRole = request.auth?.token?.role as string;

    if (!userId || !adjustment || !reason) {
      throw new HttpsError('invalid-argument', 'userId, adjustment, and reason required');
    }

    if (adminRole !== 'super_admin') {
      throw new HttpsError('permission-denied', 'Only super_admin can adjust balances');
    }

    const db = getFirestore();

    // Get user's current vacation balance
    const balanceSnap = await db
      .collection('vacation_adjustments')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    let currentBalance = 0;
    if (!balanceSnap.empty) {
      const lastAdjustment = balanceSnap.docs[0].data();
      currentBalance = lastAdjustment.balanceAfter;
    } else {
      // Calculate from leave requests
      const monthsSinceStart = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 30));
      const leaveSnap = await db
        .collection('leave_requests')
        .where('userId', '==', userId)
        .where('type', '==', 'vacation')
        .where('status', '==', 'approved')
        .get();
      currentBalance = monthsSinceStart * 2 - leaveSnap.size;
    }

    const newBalance = currentBalance + adjustment;

    // Record adjustment
    const adjustmentRef = db.collection('vacation_adjustments').doc();
    await adjustmentRef.set({
      id: adjustmentRef.id,
      userId,
      adjustment,
      reason,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      adjustedBy: adminId,
      createdAt: Timestamp.now(),
    });

    // Audit log
    const auditRef = db.collection('audit_log').doc();
    await auditRef.set({
      id: auditRef.id,
      action: 'vacation_adjustment',
      entityType: 'user',
      entityId: userId,
      changes: {
        vacationBalance: { before: currentBalance, after: newBalance },
      },
      reason,
      performedBy: adminId,
      createdAt: Timestamp.now(),
    });

    return {
      userId,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      adjustment,
    };
  },
);

// ============ Scheduled Tasks ============

/**
 * Runs daily at configured time (14:00 UTC by default).
 * Generates tomorrow's absence summary and sends notifications to managers.
 */
export const dailyReminderScheduler = onSchedule(
  'every day 14:00',
  async () => {
    const db = getFirestore();

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get all approved leave for tomorrow
    const leaveSnap = await db
      .collection('leave_requests')
      .where('date', '==', tomorrowStr)
      .where('status', '==', 'approved')
      .get();

    if (leaveSnap.empty) {
      console.log(`[${new Date().toISOString()}] No absences for ${tomorrowStr}`);
      return;
    }

    // Group by type
    const dayOffCount = leaveSnap.docs.filter((d) => d.data().type === 'day_off').length;
    const vacationCount = leaveSnap.docs.filter((d) => d.data().type === 'vacation').length;

    // Get all managers and super admins
    const managersSnap = await db
      .collection('users')
      .where('role', 'in', ['manager', 'super_admin'])
      .where('isActive', '==', true)
      .get();

    // Create notification for each manager
    const batch = db.batch();
    const now = Timestamp.now();

    managersSnap.docs.forEach((managerDoc) => {
      const notificationRef = db.collection('notifications').doc();
      batch.set(notificationRef, {
        id: notificationRef.id,
        userId: managerDoc.id,
        type: 'daily_reminder',
        title: `Tomorrow's Absences`,
        body: `${dayOffCount} day-offs, ${vacationCount} vacations`,
        data: {
          date: tomorrowStr,
          dayOffCount,
          vacationCount,
          staffAbsent: leaveSnap.docs.map((d) => d.data().userId),
        },
        read: false,
        createdAt: now,
      });
    });

    await batch.commit();
    console.log(
      `[${new Date().toISOString()}] Daily reminder created for ${managersSnap.size} managers`
    );
  }
);
