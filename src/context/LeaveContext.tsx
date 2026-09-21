import {
  createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode,
} from 'react';
import type { LeaveRequest, LeaveType, LeaveStatus } from '../models/leave';
import { LEAVE_TYPE_LABELS } from '../models/leave';
import type { LeaveBalance } from '../models/balance';
import type { UserRef } from '../models/user';
import { computeBalance } from '../services/balanceService';
import {
  insertLeaveRequest, updateLeaveRequestDb, insertAuditLog, insertNotification,
  listenLeaveRequests, cancelLeaveRequest, approveLeaveRequest, rejectLeaveRequest,
} from '../services/firestoreService';
import {
  CYCLE_LENGTH_DAYS as _CYCLE_LENGTH_DAYS, VACATION_ACCRUAL_PER_MONTH,
  isFirstSundayOfMonth, normalizeDateStr,
} from '../models/validation';
import { formatDateLocal } from '../utils/dateUtils';
import { getCycleForDate as getNewCycle } from '../utils/cycleUtils';
import { useAppData } from './AppDataContext';
import { validateLeaveRequests } from '../utils/dataValidation';
import { checkStaffingBeforeSubmit } from '../services/staffingCheckOnSubmit';

interface LeaveContextValue {
  requests: LeaveRequest[];
  loading: boolean;
  submitRequest: (userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note?: string, autoApprove?: boolean) => Promise<string | null>;
  cancelRequest: (requestId: string) => void;
  approve: (requestId: string, approver: UserRef, note?: string) => void;
  reject: (requestId: string, approver: UserRef, note?: string) => void;
  override: (requestId: string, newStatus: LeaveStatus, admin: UserRef, note?: string) => void;
  directAssign: (targetUserId: string, targetUserName: string, targetUserRole: 'staff' | 'manager' | 'super_admin', date: string, leaveType: LeaveType, adminName: string) => Promise<string | null>;
  getBalance: (userId: string) => LeaveBalance;
  getUserRequests: (userId: string) => LeaveRequest[];
  getPendingRequests: () => LeaveRequest[];
  getRequestsForDate: (date: string) => LeaveRequest[];
}

const LeaveContext = createContext<LeaveContextValue | null>(null);

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

export function LeaveProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { users, staffingRules, roleAssignments, jobRoles } = useAppData();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenLeaveRequests(
      (data: any) => {
        try {
          const validated = validateLeaveRequests(data);

          // Enrich leave requests with actual user data from the users collection
          // CRITICAL: Filter out requests from deleted/inactive users
          const enriched = validated
            .map((req: LeaveRequest) => {
              const actualUser = users.find(u => u.id === req.userId);
              if (actualUser && actualUser.isActive) {
                return {
                  ...req,
                  userRef: {
                    id: actualUser.id,
                    displayName: actualUser.displayName || actualUser.username || 'Unknown User',
                    role: actualUser.role,
                  },
                };
              }
              return null;
            })
            .filter((req): req is LeaveRequest => req !== null);

          setRequests(enriched);
        } catch (err) {
          console.error('Error validating leave requests:', err);
          setRequests([]);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [users]);

  const submitRequest = useCallback(async (
    userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note: string = '', autoApprove: boolean = false,
  ): Promise<string | null> => {
    const normalizedDate = normalizeDateStr(date);

    const existing = requests.find(
      (r) => r.userId === userId && r.date === normalizedDate && r.status !== 'cancelled',
    );
    if (existing) return 'You already have a request for this date';

    if (isFirstSundayOfMonth(normalizedDate)) {
      return 'First Sunday of each month is automatically assigned off';
    }

    const cycle = getCycleForDate(normalizedDate);
    const balance = computeBalance(
      userId, cycle.start, cycle.end,
      requests.filter((r) => r.status === 'approved'),
      getVacationAccrual(userId, users),
      getRegularOverride(userId, users),
    );
    if (leaveType === 'regular_day_off' && balance.regularDaysRemaining <= 0) {
      return 'No regular days off remaining in this cycle';
    }
    if (leaveType === 'paid_vacation' && balance.vacationDaysRemaining <= 0) {
      return 'No vacation days remaining';
    }

    const staffingErr = checkStaffingBeforeSubmit(normalizedDate, userId, requests, staffingRules, roleAssignments, jobRoles);
    if (staffingErr) return staffingErr;

    let id: string;
    try {
      id = await insertLeaveRequest({
        userId,
        userDisplayName: userRef.displayName,
        userRole: userRef.role,
        type: leaveType,
        date: normalizedDate,
        reason: note,
      });
    } catch (err) {
      console.error('Failed to save leave request:', err);
      return 'Failed to save your request — please try again';
    }

    const newRequest: LeaveRequest = {
      id, userId, userRef, date: normalizedDate, leaveType,
      status: autoApprove ? 'approved' : 'pending', staffNote: note, approverNote: '',
      decidedBy: null, decidedAt: null,
      isOverridden: false, overriddenBy: null, overriddenAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setRequests((prev) => [newRequest, ...prev]);

    const displayName = userRef.displayName ?? 'Unknown';
    await insertAuditLog({
      actorId: userId, actorName: displayName,
      action: 'leave_requested', entityType: 'leave_request', entityId: id,
      description: `${displayName} requested ${LEAVE_TYPE_LABELS[leaveType] ?? leaveType} for ${new Date(normalizedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    });

    if (autoApprove) {
      const approvedSnapshot = [...requests.filter((r) => r.status === 'approved'), newRequest];
      notifyManagersOfDeduction(newRequest, approvedSnapshot, users);
    }

    return null;
  }, [requests, users, staffingRules, roleAssignments, jobRoles]);

  const cancelRequest = useCallback((requestId: string) => {
    cancelLeaveRequest(requestId).catch((err: any) => {
      console.error('Failed to cancel request:', err);
    });
  }, []);

  const approve = useCallback((requestId: string, approver: UserRef, note: string = '') => {
    const now = new Date().toISOString();
    const req = requests.find((r) => r.id === requestId);
    if (!req || !req.userRef) return;
    // A manager can approve staff requests only — never their own request, and
    // never another manager's. Only super_admin may approve a manager's leave.
    if ((approver?.role ?? 'staff') !== 'super_admin' && (req.userId === approver?.id || (req.userRef?.role ?? 'staff') !== 'staff')) {
      return;
    }
    const staffName = req?.userRef?.displayName ?? 'Unknown';
    const dateLabel = new Date((req?.date ?? '') + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const typeLabel = LEAVE_TYPE_LABELS[req?.leaveType] ?? req?.leaveType ?? 'Leave';

    setRequests((prev) => {
      let updated = prev.map((r) =>
        r.id === requestId ? {
          ...r, status: 'approved' as LeaveStatus, decidedBy: approver,
          decidedAt: now, approverNote: note, updatedAt: now,
        } : r,
      );

      const reqMonth = req.date.slice(0, 7);
      const userApproved = updated.filter(
        (r) => r.userId === req.userId && r.date.startsWith(reqMonth)
          && r.status === 'approved' && r.id !== requestId
      );

      if (userApproved.length >= 6) {
        const autoAssigned = userApproved.filter(
          (r) => r.staffNote?.includes('Auto') || r.approverNote?.includes('Auto')
        );
        const toCancel = autoAssigned.length > 0 ? autoAssigned[autoAssigned.length - 1] : null;

        if (toCancel) {
          updated = updated.map((r) =>
            r.id === toCancel.id ? { ...r, status: 'cancelled' as LeaveStatus, updatedAt: now } : r,
          );
          updateLeaveRequestDb(toCancel.id, { status: 'cancelled' });
          const cancelDate = new Date(toCancel.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          insertAuditLog({
            actorId: approver.id, actorName: approver.displayName,
            action: 'leave_rebalanced', entityType: 'leave_request', entityId: toCancel.id,
            description: `Auto-rebalance: cancelled ${staffName}'s auto-assigned day off on ${cancelDate} (swapped for manually requested ${dateLabel})`,
          });
        }
      }

      return updated;
    });

    approveLeaveRequest(requestId, note).catch((err: any) => {
      console.error('Failed to approve request:', err);
    });
    insertAuditLog({
      actorId: approver.id, actorName: approver.displayName,
      action: 'leave_approved', entityType: 'leave_request', entityId: requestId,
      description: `${approver.displayName} approved ${staffName}'s ${typeLabel} for ${dateLabel}`,
    });

    const approvedSnapshot = requests
      .map((r) => (r.id === requestId ? { ...r, status: 'approved' as LeaveStatus } : r))
      .filter((r) => r.status === 'approved');
    notifyManagersOfDeduction(req, approvedSnapshot, users, approver.id);
  }, [requests, users]);

  const reject = useCallback((requestId: string, approver: UserRef, note: string = '') => {
    const now = new Date().toISOString();
    const req = requests.find((r) => r.id === requestId);
    const staffName = req?.userRef.displayName ?? 'Unknown';
    const dateLabel = req ? new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    const typeLabel = req ? (LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType) : '';
    setRequests((prev) => prev.map((r) =>
      r.id === requestId ? {
        ...r, status: 'rejected' as LeaveStatus, decidedBy: approver,
        decidedAt: now, approverNote: note, updatedAt: now,
      } : r,
    ));
    rejectLeaveRequest(requestId, note).catch((err: any) => {
      console.error('Failed to reject request:', err);
    });
    insertAuditLog({
      actorId: approver.id, actorName: approver.displayName,
      action: 'leave_rejected', entityType: 'leave_request', entityId: requestId,
      description: `${approver.displayName} rejected ${staffName}'s ${typeLabel} for ${dateLabel}`,
    });
  }, [requests]);

  const overrideReq = useCallback((requestId: string, newStatus: LeaveStatus, admin: UserRef, note: string = '') => {
    const now = new Date().toISOString();
    setRequests((prev) => prev.map((r) =>
      r.id === requestId ? {
        ...r, status: newStatus, isOverridden: true, overriddenBy: admin,
        overriddenAt: now, approverNote: note, updatedAt: now,
      } : r,
    ));
    const adminName = admin.displayName ?? 'Unknown';
    updateLeaveRequestDb(requestId, {
      status: newStatus, isOverridden: true,
      overriddenById: admin.id, overriddenByName: adminName,
      overriddenAt: now, approverNote: note,
    });
    insertAuditLog({
      actorId: admin.id, actorName: adminName,
      action: 'leave_overridden', entityType: 'leave_request', entityId: requestId,
      description: `${adminName} overrode ${(() => { const r = requests.find((x) => x.id === requestId); return r ? (r.userRef.displayName ?? 'Unknown') + "'s request" : 'a request'; })()} to ${newStatus}`,
    });
  }, [requests]);

  const directAssign = useCallback(async (
    targetUserId: string, targetUserName: string,
    targetUserRole: 'staff' | 'manager' | 'super_admin',
    date: string, leaveType: LeaveType, adminName: string,
  ): Promise<string | null> => {
    const normalizedDate = normalizeDateStr(date);

    const existing = requests.filter(
      (r) => r.userId === targetUserId && r.date === normalizedDate && r.status !== 'cancelled',
    );
    for (const r of existing) {
      await updateLeaveRequestDb(r.id, { status: 'cancelled' });
    }

    const id = await insertLeaveRequest({
      userId: targetUserId,
      userDisplayName: targetUserName,
      userRole: targetUserRole,
      type: leaveType,
      date: normalizedDate,
      reason: `Directly assigned by ${adminName} (admin bypass)`,
    });

    const nowIso = new Date().toISOString();
    const newEntry: LeaveRequest = {
      id, userId: targetUserId,
      userRef: { id: targetUserId, displayName: targetUserName, role: targetUserRole },
      date: normalizedDate, leaveType, status: 'approved',
      staffNote: '', approverNote: `Directly assigned by ${adminName} (admin bypass)`,
      decidedBy: null, decidedAt: nowIso,
      isOverridden: false, overriddenBy: null, overriddenAt: null,
      createdAt: nowIso, updatedAt: nowIso,
    };

    setRequests((prev) => {
      const updated = prev.map((r) =>
        r.userId === targetUserId && r.date === normalizedDate && r.status !== 'cancelled'
          ? { ...r, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : r,
      );
      return [newEntry, ...updated];
    });

    await insertAuditLog({
      actorId: 'admin', actorName: adminName,
      action: 'leave_approved', entityType: 'leave_request', entityId: id,
      description: `${adminName} directly assigned ${LEAVE_TYPE_LABELS[leaveType] ?? leaveType} to ${targetUserName} for ${new Date(normalizedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    });

    const approvedSnapshot = [
      ...requests.filter((r) => r.status === 'approved' && !(r.userId === targetUserId && r.date === normalizedDate)),
      newEntry,
    ];
    notifyManagersOfDeduction(newEntry, approvedSnapshot, users);

    return null;
  }, [requests, users]);

  const getBalance = useCallback((userId: string): LeaveBalance => {
    const today = formatDateLocal(new Date());
    const cycle = getCycleForDate(today);
    return computeBalance(
      userId, cycle.start, cycle.end,
      requests.filter((r) => r.status === 'approved'),
      getVacationAccrual(userId, users),
      getRegularOverride(userId, users),
    );
  }, [requests, users]);

  const getUserRequests = useCallback(
    (userId: string) => requests.filter((r) =>
      r.userId === userId &&
      users.find(u => u.id === r.userId && u.isActive)
    ),
    [requests, users],
  );
  const getPendingRequests = useCallback(
    () => requests.filter((r) =>
      r.status === 'pending' &&
      r.userRef?.role === 'staff' &&
      users.find(u => u.id === r.userId && u.isActive)
    ),
    [requests, users],
  );
  const getRequestsForDate = useCallback(
    (date: string) => requests.filter((r) =>
      r.date === date &&
      users.find(u => u.id === r.userId && u.isActive)
    ),
    [requests, users],
  );

  const value = useMemo(() => ({
    requests, loading, submitRequest, cancelRequest, approve, reject,
    override: overrideReq, directAssign, getBalance, getUserRequests,
    getPendingRequests, getRequestsForDate,
  }), [requests, loading, submitRequest, cancelRequest, approve, reject,
    overrideReq, directAssign, getBalance, getUserRequests, getPendingRequests, getRequestsForDate]);

  return <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>;
}

export function useLeave(): LeaveContextValue {
  const ctx = useContext(LeaveContext);
  if (!ctx) throw new Error('useLeave must be used inside LeaveProvider');
  return ctx;
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
  req: { userId: string; userRef: UserRef; date: string; leaveType: LeaveType },
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
    ? `🌴 Vacation deducted — ${req.userRef.displayName}`
    : `📅 Regular day off deducted — ${req.userRef.displayName}`;
  const body = isVacation
    ? `${req.userRef.displayName}'s vacation for ${dateLabel} was approved. Vacation balance: ${balance.vacationDaysRemaining} of ${balance.vacationDaysTotal} remaining.`
    : `${req.userRef.displayName}'s day off for ${dateLabel} was approved. Regular days: ${balance.regularDaysRemaining} of ${balance.regularDaysAllowed} remaining this cycle.`;

  const recipients = users.filter((u) =>
    (u.role === 'manager' || u.role === 'super_admin') && u.isActive && u.id !== excludeActorId,
  );

  for (const r of recipients) {
    try {
      await insertNotification({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: r.id,
        type: 'leave_approved',
        title,
        body,
        data: {
          entityType: 'leave_request',
          entityId: req.userId,
          createdBy: excludeActorId ?? 'system',
        },
      });
    } catch (e) {
      console.error('notifyManagersOfDeduction error:', e);
    }
  }
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
