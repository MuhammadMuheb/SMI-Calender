import {
  createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode,
} from 'react';
import type { LeaveRequest, LeaveType, LeaveStatus } from '@/models/leave';
import { LEAVE_TYPE_LABELS } from '@/models/leave';
import type { LeaveBalance } from '@/models/balance';
import type { UserRef } from '@/models/user';
import { computeBalance } from '@/services/balanceService';
import {
  insertLeaveRequest, updateLeaveRequestDb, insertAuditLog, insertNotification,
  listenLeaveRequests, cancelLeaveRequest, approveLeaveRequest, rejectLeaveRequest,
} from '@/services/firestore/core';
import { sendPushToUser } from '@/features/notifications/pushManager';
import {
  VACATION_ACCRUAL_PER_MONTH,
  isFirstSundayOfMonth, normalizeDateStr,
} from '@/models/validation';
import { formatDateLocal } from '@/utils/dateUtils';
import { getCycleForDate as getNewCycle } from '@/utils/cycleUtils';
import { useAppData } from '@/app/AppDataContext';
import { useNotifications } from '@/features/notifications/NotificationContext';
import { validateLeaveRequests } from '@/utils/dataValidation';
import { getDatesBetween } from '@/utils/dateRangeUtils';
import type { NotificationType } from '@/models/notification';
import { checkStaffingBeforeSubmit } from '@/features/leave/services/staffingCheckOnSubmit';

interface LeaveContextValue {
  requests: LeaveRequest[];
  loading: boolean;
  /** Last listener error, if the live request feed failed. */
  error: string | null;
  submitRequest: (userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note?: string, autoApprove?: boolean) => Promise<string | null>;
  /** Submit one request per day for an inclusive date range (e.g. a vacation). */
  submitRangeRequest: (userRef: UserRef, startDate: string, endDate: string, leaveType: LeaveType, note?: string) => Promise<string | null>;
  cancelRequest: (requestId: string) => Promise<string | null>;
  approve: (requestId: string, approver: UserRef, note?: string) => Promise<string | null>;
  reject: (requestId: string, approver: UserRef, note?: string) => Promise<string | null>;
  override: (requestId: string, newStatus: LeaveStatus, admin: UserRef, note?: string) => Promise<string | null>;
  directAssign: (targetUserId: string, targetUserName: string, targetUserRole: 'staff' | 'manager' | 'super_admin', date: string, leaveType: LeaveType, adminName: string) => Promise<string | null>;
  getBalance: (userId: string) => LeaveBalance;
  getCycleBalance: (userId: string) => LeaveBalance;
  getUserRequests: (userId: string) => LeaveRequest[];
  getPendingRequests: () => LeaveRequest[];
  getRequestsForDate: (date: string) => LeaveRequest[];
}

const LeaveContext = createContext<LeaveContextValue | null>(null);

const MAX_RANGE_DAYS = 30;

function getCycleForDate(dateStr: string): { start: string; end: string } {
  const cycle = getNewCycle(dateStr);
  if (cycle) return { start: cycle.start, end: cycle.end };
  const d = new Date(dateStr + "T00:00:00");
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const cycleEnd = new Date(monthEnd);
  const dow = cycleEnd.getDay();
  if (dow !== 0) cycleEnd.setDate(cycleEnd.getDate() + (7 - dow));
  return { start: formatDateLocal(new Date(d.getFullYear(), d.getMonth(), 1)), end: formatDateLocal(cycleEnd) };
}

function shortDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Only a super admin may decide on a manager's (or their own) request. */
function canDecide(approver: UserRef, req: LeaveRequest): boolean {
  if (approver.role === 'super_admin') return true;
  return req.userId !== approver.id && (req.userRef?.role ?? 'staff') === 'staff';
}

export function LeaveProvider({ children }: { children: ReactNode }) {
  const [rawRequests, setRawRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { users, staffingRules, roleAssignments, jobRoles } = useAppData();
  const { markEntityAsRead } = useNotifications();

  // Live feed of all leave requests.
  useEffect(() => {
    const unsubscribe = listenLeaveRequests(
      (data) => {
        setRawRequests(validateLeaveRequests(data));
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  // Keep each request's userRef in sync with the current user directory.
  const requests = useMemo(() => {
    if (users.length === 0) return rawRequests;
    const byId = new Map(users.map((u) => [u.id, u]));
    return rawRequests.map((req) => {
      const u = byId.get(req.userId);
      if (!u) return req;
      return { ...req, userRef: { id: u.id, displayName: u.displayName || u.username || 'Unknown User', role: u.role } };
    });
  }, [rawRequests, users]);

  const approvedRequests = useMemo(() => requests.filter((r) => r.status === 'approved'), [requests]);

  const saveRequest = useCallback(async (
    userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note: string,
    status: LeaveStatus, approverNote = '',
  ): Promise<LeaveRequest> => {
    const nowIso = new Date().toISOString();
    const draft: Omit<LeaveRequest, 'id'> = {
      userId,
      userRef,
      date,
      leaveType,
      status,
      staffNote: note,
      approverNote,
      decidedBy: null,
      decidedAt: status === 'approved' ? nowIso : null,
      isOverridden: false,
      overriddenBy: null,
      overriddenAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const id = await insertLeaveRequest(draft);
    const saved: LeaveRequest = { ...draft, id };
    // Optimistic insert; the live listener replaces it with the stored doc.
    setRawRequests((prev) => (prev.some((r) => r.id === id) ? prev : [saved, ...prev]));
    return saved;
  }, []);

  const submitRequest = useCallback(async (
    userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note: string = '', autoApprove: boolean = false,
  ): Promise<string | null> => {
    const normalizedDate = normalizeDateStr(date);

    const existing = requests.find(
      (r) => r.userId === userId && r.date === normalizedDate && (r.status === 'pending' || r.status === 'approved'),
    );
    if (existing) return 'You already have a request for this date';

    if (leaveType !== 'sick_day' && isFirstSundayOfMonth(normalizedDate)) {
      return 'First Sunday of each month is automatically assigned off';
    }

    const cycle = getCycleForDate(normalizedDate);
    const balance = computeBalance(
      userId, cycle.start, cycle.end, approvedRequests,
      getVacationAccrual(userId, users), getRegularOverride(userId, users),
    );
    const isExceedingQuota =
      (leaveType === 'regular_day_off' && balance.regularDaysRemaining < 0) ||
      (leaveType === 'paid_vacation' && balance.vacationDaysRemaining < 0);

    const staffingErr = leaveType === 'sick_day' ? null : checkStaffingBeforeSubmit(normalizedDate, userId, requests, staffingRules, roleAssignments, jobRoles);
    if (staffingErr) return staffingErr;

    let saved: LeaveRequest;
    try {
      saved = await saveRequest(userId, userRef, normalizedDate, leaveType, note, autoApprove ? 'approved' : 'pending');
    } catch (err) {
      console.error('Failed to save leave request:', err);
      return 'Failed to save your request — please try again';
    }

    const displayName = userRef.displayName ?? 'Unknown';
    await insertAuditLog({
      actorId: userId, actorName: displayName,
      action: 'leave_requested', entityType: 'leave_request', entityId: saved.id,
      description: `${displayName} requested ${LEAVE_TYPE_LABELS[leaveType] ?? leaveType} for ${shortDate(normalizedDate)}`,
    });

    if (autoApprove) {
      notifyManagersOfDeduction(saved, [...approvedRequests, saved], users);
    } else {
      await notifyApproversOfNewRequest(saved, shortDate(normalizedDate), users);
    }
    if (isExceedingQuota) {
      await notifyAdminsOfQuotaExceeded(saved, balance, leaveType, users);
    }
    return null;
  }, [requests, approvedRequests, users, staffingRules, roleAssignments, jobRoles, saveRequest]);

  const submitRangeRequest = useCallback(async (
    userRef: UserRef, startDate: string, endDate: string, leaveType: LeaveType, note: string = '',
  ): Promise<string | null> => {
    const start = normalizeDateStr(startDate);
    const end = normalizeDateStr(endDate);
    if (!start || !end || end < start) return 'Please choose a valid date range';

    const dates = getDatesBetween(start, end);
    if (dates.length > MAX_RANGE_DAYS) return `You can request at most ${MAX_RANGE_DAYS} days at once`;

    const taken = new Set(
      requests
        .filter((r) => r.userId === userRef.id && (r.status === 'pending' || r.status === 'approved'))
        .map((r) => r.date),
    );
    const clash = dates.find((d) => taken.has(d));
    if (clash) return `You already have a request on ${shortDate(clash)}`;

    for (const d of dates) {
      const staffingErr = leaveType === 'sick_day' ? null : checkStaffingBeforeSubmit(d, userRef.id, requests, staffingRules, roleAssignments, jobRoles);
      if (staffingErr) return `${shortDate(d)}: ${staffingErr}`;
    }

    const saved: LeaveRequest[] = [];
    try {
      for (const d of dates) {
        saved.push(await saveRequest(userRef.id, userRef, d, leaveType, note, 'pending'));
      }
    } catch (err) {
      console.error('Failed to save range request:', err);
      return saved.length > 0
        ? `Only ${saved.length} of ${dates.length} days were saved — please check your requests and try again`
        : 'Failed to save your request — please try again';
    }

    const typeLabel = LEAVE_TYPE_LABELS[leaveType] ?? leaveType;
    const rangeLabel = dates.length === 1 ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)} (${dates.length} days)`;
    await insertAuditLog({
      actorId: userRef.id, actorName: userRef.displayName,
      action: 'leave_requested', entityType: 'leave_request', entityId: saved[0].id,
      description: `${userRef.displayName} requested ${typeLabel} for ${rangeLabel}`,
    });
    await notifyApproversOfNewRequest(saved[0], rangeLabel, users);
    return null;
  }, [requests, users, staffingRules, roleAssignments, jobRoles, saveRequest]);

  const cancelRequest = useCallback(async (requestId: string): Promise<string | null> => {
    markEntityAsRead(requestId);
    try {
      await cancelLeaveRequest(requestId);
      return null;
    } catch (err) {
      console.error('Failed to cancel request:', err);
      return 'Could not cancel the request — please try again';
    }
  }, [markEntityAsRead]);

  const approve = useCallback(async (requestId: string, approver: UserRef, note: string = ''): Promise<string | null> => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return 'Request not found';
    if (!canDecide(approver, req)) return 'Only a super admin can decide on this request';


    try {
      await approveLeaveRequest(requestId, approver, note);
    } catch (err) {
      console.error('Failed to approve request:', err);
      return 'Could not approve the request — please try again';
    }
    markEntityAsRead(requestId);

    const approvedSnapshot = requests
      .map((r) => (r.id === requestId ? { ...r, status: 'approved' as LeaveStatus } : r))
      .filter((r) => r.status === 'approved');
    notifyManagersOfDeduction(req, approvedSnapshot, users, approver.id);
    notifyUserOfApproval(req, requestId, approver, note);
    return null;
  }, [requests, users, markEntityAsRead]);

  const reject = useCallback(async (requestId: string, approver: UserRef, note: string = ''): Promise<string | null> => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return 'Request not found';
    if (!canDecide(approver, req)) return 'Only a super admin can decide on this request';

    try {
      await rejectLeaveRequest(requestId, approver, note);
    } catch (err) {
      console.error('Failed to reject request:', err);
      return 'Could not reject the request — please try again';
    }
    markEntityAsRead(requestId);

    const staffName = req.userRef.displayName ?? 'Unknown';
    const typeLabel = LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType;
    insertAuditLog({
      actorId: approver.id, actorName: approver.displayName,
      action: 'leave_rejected', entityType: 'leave_request', entityId: requestId,
      description: `${approver.displayName} rejected ${staffName}'s ${typeLabel} for ${shortDate(req.date)}`,
    });
    notifyUserOfRejection(req, requestId, approver, note);
    return null;
  }, [requests, markEntityAsRead]);

  const overrideReq = useCallback(async (
    requestId: string, newStatus: LeaveStatus, admin: UserRef, note: string = '',
  ): Promise<string | null> => {
    const req = requests.find((r) => r.id === requestId);
    const now = new Date().toISOString();
    const adminName = admin.displayName ?? 'Unknown';
    try {
      await updateLeaveRequestDb(requestId, {
        status: newStatus, isOverridden: true,
        overriddenBy: { id: admin.id, displayName: adminName, role: admin.role },
        overriddenAt: now, approverNote: note,
      });
    } catch (err) {
      console.error('Failed to override request:', err);
      return 'Could not update the request — please try again';
    }
    insertAuditLog({
      actorId: admin.id, actorName: adminName,
      action: 'leave_overridden', entityType: 'leave_request', entityId: requestId,
      description: `${adminName} overrode ${req ? `${req.userRef.displayName ?? 'Unknown'}'s request` : 'a request'} to ${newStatus}`,
    });
    if (req) notifyUserOfOverride(req, requestId, newStatus, admin, note);
    return null;
  }, [requests]);

  const directAssign = useCallback(async (
    targetUserId: string, targetUserName: string,
    targetUserRole: 'staff' | 'manager' | 'super_admin',
    date: string, leaveType: LeaveType, adminName: string,
  ): Promise<string | null> => {
    const normalizedDate = normalizeDateStr(date);
    const adminNote = `Directly assigned by ${adminName} (admin bypass)`;
    try {
      const existing = requests.filter(
        (r) => r.userId === targetUserId && r.date === normalizedDate && r.status !== 'cancelled',
      );
      for (const r of existing) {
        await updateLeaveRequestDb(r.id, { status: 'cancelled' });
      }

      const saved = await saveRequest(
        targetUserId, { id: targetUserId, displayName: targetUserName, role: targetUserRole },
        normalizedDate, leaveType, '', 'approved', adminNote,
      );

      await insertAuditLog({
        actorId: 'admin', actorName: adminName,
        action: 'leave_approved', entityType: 'leave_request', entityId: saved.id,
        description: `${adminName} directly assigned ${LEAVE_TYPE_LABELS[leaveType] ?? leaveType} to ${targetUserName} for ${shortDate(normalizedDate)}`,
      });

      const approvedSnapshot = [
        ...approvedRequests.filter((r) => !(r.userId === targetUserId && r.date === normalizedDate)),
        saved,
      ];
      notifyManagersOfDeduction(saved, approvedSnapshot, users);
      await notifyUserOfDirectAssignment(targetUserId, saved.id, normalizedDate, leaveType, adminName, adminNote);
      return null;
    } catch (err) {
      console.error('Direct assignment failed:', err);
      return 'Could not assign leave — please try again';
    }
  }, [requests, approvedRequests, users, saveRequest]);

  // Deleted/inactive users' leave must not affect anyone's balance.
  const activeApproved = useMemo(() => {
    const active = new Set(users.filter((u) => u.isActive).map((u) => u.id));
    return approvedRequests.filter((r) => active.has(r.userId));
  }, [approvedRequests, users]);

  const getBalance = useCallback((userId: string): LeaveBalance => {
    const cycle = getCycleForDate(formatDateLocal(new Date()));
    return computeBalance(
      userId, cycle.start, cycle.end, activeApproved,
      getVacationAccrual(userId, users), getRegularOverride(userId, users),
    );
  }, [activeApproved, users]);

  /** Cycle-only balance for weekly views — deliberately excludes vacation. */
  const getCycleBalance = useCallback((userId: string): LeaveBalance => {
    const cycle = getCycleForDate(formatDateLocal(new Date()));
    return computeBalance(userId, cycle.start, cycle.end, activeApproved, 0, getRegularOverride(userId, users));
  }, [activeApproved, users]);

  const getUserRequests = useCallback(
    (userId: string) => requests.filter((r) => r.userId === userId),
    [requests],
  );
  const getPendingRequests = useCallback(
    () => requests.filter((r) => r.status === 'pending'),
    [requests],
  );
  const getRequestsForDate = useCallback(
    (date: string) => requests.filter((r) => r.date === date),
    [requests],
  );

  const value = useMemo(() => ({
    requests, loading, error, submitRequest, submitRangeRequest, cancelRequest, approve, reject,
    override: overrideReq, directAssign, getBalance, getCycleBalance, getUserRequests,
    getPendingRequests, getRequestsForDate,
  }), [requests, loading, error, submitRequest, submitRangeRequest, cancelRequest, approve, reject,
    overrideReq, directAssign, getBalance, getCycleBalance, getUserRequests, getPendingRequests, getRequestsForDate]);

  return <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>;
}

export function useLeave(): LeaveContextValue {
  const ctx = useContext(LeaveContext);
  if (!ctx) throw new Error('useLeave must be used inside LeaveProvider');
  return ctx;
}

/**
 * Notify admins when a user exceeds their leave quota
 * This is a HIGH-PRIORITY notification to alert admins of over-quota requests
 */
async function notifyAdminsOfQuotaExceeded(
  req: { id?: string; userId: string; userRef: UserRef; date: string; leaveType: LeaveType },
  balance: { regularDaysRemaining: number; regularDaysAllowed: number; vacationDaysRemaining: number; vacationDaysTotal: number },
  leaveType: LeaveType,
  users: { id: string; role: string; isActive: boolean }[],
): Promise<void> {
  const dateLabel = new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const typeLabel = LEAVE_TYPE_LABELS[leaveType] ?? leaveType;

  let balanceInfo = '';
  if (leaveType === 'regular_day_off') {
    balanceInfo = `Regular Days: ${balance.regularDaysRemaining}/${balance.regularDaysAllowed} (exceeded by ${Math.abs(balance.regularDaysRemaining)} day${Math.abs(balance.regularDaysRemaining) === 1 ? '' : 's'})`;
  } else if (leaveType === 'paid_vacation') {
    balanceInfo = `Vacation Days: ${balance.vacationDaysRemaining}/${balance.vacationDaysTotal} (exceeded by ${Math.abs(balance.vacationDaysRemaining)} day${Math.abs(balance.vacationDaysRemaining) === 1 ? '' : 's'})`;
  }

  const title = `Over quota: ${typeLabel.toLowerCase()}`;
  const body = `${req.userRef.displayName} requested ${typeLabel.toLowerCase()} for ${dateLabel} but has EXCEEDED their quota.\n\n${balanceInfo}\n\nPlease review and take action.`;

  // Get all active admins and managers
  const recipients = users.filter((u) =>
    (u.role === 'manager' || u.role === 'super_admin') && u.isActive,
  );

  for (const admin of recipients) {
    try {
      // Save HIGH-PRIORITY notification to Firestore
      await insertNotification({
        userId: admin.id,
        type: 'balance_adjusted', // Using existing type for quota alerts
        title,
        body,
        isRead: false,
        confirmStatus: 'pending',
        rejectReason: '',
        entityType: 'leave_request',
        entityId: req.id ?? req.userId,
        createdAt: new Date().toISOString(),
      });

      // Send push notification with high priority tag
      await sendPushToUser(admin.id, title, body, 'quota-exceeded');
    } catch (e) {
      console.error(`[NOTIFICATION] Failed to notify admin ${admin.id} of quota excess:`, e);
    }
  }
}

function getRegularOverride(userId: string, users: { id: string; regularOverride?: number | null }[]): number | null {
  const user = users.find((u) => u.id === userId);
  return user?.regularOverride ?? null;
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

/**
 * Notify every active manager/super admin whenever a request that actually
 * deducts from a balance (regular day off or paid vacation) becomes approved,
 * so they see the updated remaining balance immediately.
 */
async function notifyManagersOfDeduction(
  req: { id?: string; userId: string; userRef: UserRef; date: string; leaveType: LeaveType },
  approvedRequests: LeaveRequest[],
  users: { id: string; role: string; isActive: boolean; createdAt: string; vacationOverride?: number | null; vacationOverrideAt?: string | null; regularOverride?: number | null }[],
  excludeActorId?: string,
): Promise<void> {
  const balanceAffectingTypes: LeaveType[] = ['regular_day_off', 'paid_vacation', 'auto_assigned', 'auto_sunday'];
  if (!balanceAffectingTypes.includes(req.leaveType)) return;

  const cycle = getCycleForDate(req.date);
  const balance = computeBalance(
    req.userId, cycle.start, cycle.end, approvedRequests,
    getVacationAccrual(req.userId, users), getRegularOverride(req.userId, users),
  );

  const dateLabel = new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isVacation = req.leaveType === 'paid_vacation';
  const title = isVacation
    ? `Vacation used: ${req.userRef.displayName}`
    : `Day off used: ${req.userRef.displayName}`;
  const body = isVacation
    ? `${req.userRef.displayName}'s vacation for ${dateLabel} was approved. Vacation balance: ${balance.vacationDaysRemaining} of ${balance.vacationDaysTotal} remaining.`
    : `${req.userRef.displayName}'s day off for ${dateLabel} was approved. Regular days: ${balance.regularDaysRemaining} of ${balance.regularDaysAllowed} remaining this cycle.`;

  const recipients = users.filter((u) =>
    (u.role === 'manager' || u.role === 'super_admin') && u.isActive && u.id !== excludeActorId,
  );

  for (const r of recipients) {
    try {
      await insertNotification({
        userId: r.id,
        type: 'leave_approved',
        title,
        body,
        isRead: false,
        confirmStatus: 'pending',
        rejectReason: '',
        entityType: 'leave_request',
        entityId: req.id ?? req.userId,
      });
    } catch (e) {
      console.error('notifyManagersOfDeduction error:', e);
    }
  }
}

interface NotifyTarget { userId: string; userRef: UserRef; date: string; leaveType: LeaveType }

async function notify(
  userId: string, type: NotificationType, title: string, body: string, entityId: string, pushTag: string,
): Promise<void> {
  try {
    await insertNotification({
      userId, type, title, body,
      isRead: false, confirmStatus: 'pending', rejectReason: '',
      entityType: 'leave_request', entityId,
    });
    await sendPushToUser(userId, title, body, pushTag);
  } catch (e) {
    console.error(`Failed to notify ${userId}:`, e);
  }
}

function notifyUserOfApproval(req: NotifyTarget, requestId: string, approver: UserRef, note = '') {
  const typeLabel = LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType;
  return notify(
    req.userId, 'leave_approved', `${typeLabel} approved`,
    `Your ${typeLabel.toLowerCase()} request for ${shortDate(req.date)} was approved by ${approver.displayName}.${note ? `\n\nNote: ${note}` : ''}`,
    requestId, 'approval',
  );
}

function notifyUserOfRejection(req: NotifyTarget, requestId: string, approver: UserRef, reason = '') {
  const typeLabel = LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType;
  return notify(
    req.userId, 'leave_rejected', `${typeLabel} declined`,
    `Your ${typeLabel.toLowerCase()} request for ${shortDate(req.date)} was declined by ${approver.displayName}.${reason ? `\n\nReason: ${reason}` : ''}`,
    requestId, 'rejection',
  );
}

function notifyUserOfOverride(req: NotifyTarget, requestId: string, newStatus: LeaveStatus, admin: UserRef, note = '') {
  const typeLabel = LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType;
  return notify(
    req.userId, 'leave_overridden', `${typeLabel} changed to ${newStatus}`,
    `Your ${typeLabel.toLowerCase()} request for ${shortDate(req.date)} was set to ${newStatus} by ${admin.displayName}.${note ? `\n\nNote: ${note}` : ''}`,
    requestId, 'override',
  );
}

function notifyUserOfDirectAssignment(
  userId: string, requestId: string, date: string, leaveType: LeaveType, adminName: string, note = '',
) {
  const typeLabel = LEAVE_TYPE_LABELS[leaveType] ?? leaveType;
  return notify(
    userId, 'leave_approved', `${typeLabel} assigned`,
    `${adminName} assigned you ${typeLabel.toLowerCase()} for ${shortDate(date)}.${note ? `\n\nNote: ${note}` : ''}`,
    requestId, 'assignment',
  );
}

/**
 * Tell everyone who can approve this request that it is waiting. Staff
 * requests go to managers and super admins; a manager's request can only be
 * decided by a super admin, so only they are notified.
 */
async function notifyApproversOfNewRequest(
  req: LeaveRequest, whenLabel: string, users: { id: string; role: string; isActive: boolean }[],
): Promise<void> {
  const requesterRole = req.userRef?.role ?? 'staff';
  const approverRoles = requesterRole === 'staff' ? ['manager', 'super_admin'] : ['super_admin'];
  const recipients = users.filter((u) => u.isActive && approverRoles.includes(u.role) && u.id !== req.userId);
  if (recipients.length === 0) {
    console.warn('No active approvers found for new leave request', req.id);
    return;
  }
  const typeLabel = LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType;
  const title = `New ${typeLabel.toLowerCase()} request`;
  const body = `${req.userRef.displayName} requested ${typeLabel.toLowerCase()} for ${whenLabel}.${req.staffNote ? `\n\nNote: ${req.staffNote}` : ''}`;
  await Promise.all(recipients.map((r) => notify(r.id, 'new_request_pending', title, body, req.id, 'new-request')));
}

function getVacationAccrual(userId: string, users: { id: string; createdAt: string; vacationOverride?: number | null; vacationOverrideAt?: string | null }[]): number {
  const user = users.find((u) => u.id === userId);
  if (!user) return 0;
  const now = new Date();
  if (user.vacationOverride != null && user.vacationOverride >= 0) {
    const since = user.vacationOverrideAt ? new Date(user.vacationOverrideAt) : now;
    return user.vacationOverride + monthsBetween(since, now) * VACATION_ACCRUAL_PER_MONTH;
  }
  return monthsBetween(new Date(user.createdAt), now) * VACATION_ACCRUAL_PER_MONTH;
}
