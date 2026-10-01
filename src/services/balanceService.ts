import type { LeaveBalance, BalanceAdjustment } from '@/models/balance';
import type { LeaveRequest } from '@/models/leave';
import {
  REGULAR_DAYS_OFF_PER_CYCLE, getFirstSundayOfMonth,
} from '@/models/validation';

/**
 * STATUS: SERVICE PLACEHOLDER
 * Pure functions that compute balances from request data.
 * No database. No persistence.
 */

export function countRegularDaysUsed(
  approvedRequests: LeaveRequest[],
): number {
  return approvedRequests.filter(
    (r) =>
      r.status === 'approved' &&
      (r.leaveType === 'regular_day_off' ||
        r.leaveType === 'auto_assigned' ||
        r.leaveType === 'auto_sunday'),
  ).length;
}

export function countVacationDaysUsed(
  approvedRequests: LeaveRequest[],
): number {
  return approvedRequests.filter(
    (r) => r.status === 'approved' && r.leaveType === 'paid_vacation',
  ).length;
}

/**
 * Compute the full balance for a user in a cycle.
 * regularOverride (optional): per-user day-off allowance; falls back to default.
 */
export function computeBalance(
  userId: string,
  cycleStart: string,
  cycleEnd: string,
  approvedRequests: LeaveRequest[],
  totalVacationAccrued: number,
  regularOverride?: number | null,
): LeaveBalance {
  const regularAllowed =
    regularOverride != null && regularOverride >= 0
      ? regularOverride
      : REGULAR_DAYS_OFF_PER_CYCLE;

  const cycleRequests = approvedRequests.filter(
    (r) => r.userId === userId && r.date >= cycleStart && r.date <= cycleEnd,
  );

  // Rule: the first Sunday of the month is always off for everyone and is one
  // of the month's regular days. Count it even when no request exists for it
  // (but don't count it twice if one was recorded, e.g. by auto-assignment).
  const start = new Date(cycleStart + 'T00:00:00');
  const firstSunday = getFirstSundayOfMonth(start.getFullYear(), start.getMonth());
  const firstSundayInCycle = firstSunday >= cycleStart && firstSunday <= cycleEnd;
  const firstSundayRecorded = cycleRequests.some((r) => r.date === firstSunday);
  const regularUsed = countRegularDaysUsed(cycleRequests) + (firstSundayInCycle && !firstSundayRecorded ? 1 : 0);
  const vacationUsed = countVacationDaysUsed(approvedRequests.filter(
    (r) => r.userId === userId,
  ));

  const autoSundayConsumed = firstSundayInCycle;

  return {
    id: `bal_${userId}_${cycleStart}`,
    userId,
    cycleStart,
    cycleEnd,
    regularDaysAllowed: regularAllowed,
    regularDaysUsed: regularUsed,
    regularDaysRemaining: Math.max(0, regularAllowed - regularUsed),
    vacationDaysTotal: totalVacationAccrued,
    vacationDaysUsed: vacationUsed,
    vacationDaysRemaining: totalVacationAccrued - vacationUsed,
    autoSundayConsumed,
    updatedAt: new Date().toISOString(),
  };
}

export function createBalanceAdjustment(
  userId: string,
  adminId: string,
  field: BalanceAdjustment['field'],
  previousValue: number,
  newValue: number,
  reason: string,
): BalanceAdjustment {
  return {
    id: `adj_${Date.now()}`,
    userId,
    adjustedBy: adminId,
    field,
    previousValue,
    newValue,
    reason,
    createdAt: new Date().toISOString(),
  };
}
