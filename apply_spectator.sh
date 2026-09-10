#!/usr/bin/env bash
#
# SMI Calendar — Spectator role + per-user day-off quota
# Run from the project root:  bash apply_spectator.sh
#
set -u

ROOT="$(pwd)"
if [ ! -f "$ROOT/package.json" ] || [ ! -d "$ROOT/src" ]; then
  echo "ERROR: run this from your smi-calendar project root (where package.json and src/ live)."
  echo "Try:  cd ~/smi-calendar && bash apply_spectator.sh"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.spectator_backup_$STAMP"
mkdir -p "$BK"
echo "==> Backing up originals to: $BK"

backup () {
  local f="$1"
  if [ -f "$ROOT/$f" ]; then
    mkdir -p "$BK/$(dirname "$f")"
    cp "$ROOT/$f" "$BK/$f"
    echo "    backed up $f"
  fi
}

for f in \
  src/config/roles.ts \
  src/models/user.ts \
  src/services/balanceService.ts \
  src/services/autoAssignService.ts \
  src/context/LeaveContext.tsx \
  src/pages/admin/VacationAdjustment.tsx \
  src/pages/admin/UserManagement.tsx \
  src/components/layout/AppShell.tsx \
  src/components/layout/BottomNav.tsx \
  src/services/supabaseService.ts ; do
  backup "$f"
done

echo "==> Writing files..."

############################################################
# 1. roles.ts
############################################################
cat > "$ROOT/src/config/roles.ts" << 'EOF'
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  SPECTATOR: 'spectator',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.STAFF]: 'Staff',
  [ROLES.SPECTATOR]: 'Spectator',
};

export const ROLE_BADGE_COLOR: Record<Role, 'secondary' | 'primary' | 'gray'> = {
  [ROLES.SUPER_ADMIN]: 'secondary',
  [ROLES.MANAGER]: 'primary',
  [ROLES.STAFF]: 'gray',
  [ROLES.SPECTATOR]: 'secondary',
};
EOF
echo "    wrote src/config/roles.ts"

############################################################
# 2. user.ts  (add regularOverride)
############################################################
cat > "$ROOT/src/models/user.ts" << 'EOF'
import type { Role } from '../config/roles';

/**
 * Full user record — represents a staff member in the system.
 * The `role` field determines UI access and permissions.
 * Hidden roles are tracked separately in StaffRole assignments.
 */
export interface StaffUser {
    id: string;
    username: string;
    displayName: string;
    pin: string; // Will be hashed in production
    role: Role;
    isActive: boolean;
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
    vacationOverride?: number | null;
    regularOverride?: number | null;
    jobRole?: string[];
}

/**
 * Minimal user reference used in logs, requests, etc.
 * Avoids passing full user objects around.
 */
export interface UserRef {
    id: string;
    displayName: string;
    role: Role;
}
EOF
echo "    wrote src/models/user.ts"

############################################################
# 3. balanceService.ts  (use regularOverride)
############################################################
cat > "$ROOT/src/services/balanceService.ts" << 'EOF'
import type { LeaveBalance, BalanceAdjustment } from '../models/balance';
import type { LeaveRequest } from '../models/leave';
import {
  REGULAR_DAYS_OFF_PER_CYCLE,
} from '../models/validation';

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

  const regularUsed = countRegularDaysUsed(cycleRequests);
  const vacationUsed = countVacationDaysUsed(approvedRequests.filter(
    (r) => r.userId === userId,
  ));

  const autoSundayConsumed = cycleRequests.some(
    (r) => r.leaveType === 'auto_sunday',
  );

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
EOF
echo "    wrote src/services/balanceService.ts"

echo "OUTER_MARKER_DONE_PART1"

############################################################
# 4. autoAssignService.ts  (per-user quota + exclude spectators)
############################################################
cat > "$ROOT/src/services/autoAssignService.ts" << 'EOF'
import type { LeaveRequest } from '../models/leave';
import type { StaffUser } from '../models/user';
import type { StaffingRule } from '../models/staffing';
import type { StaffRoleAssignment } from '../models/jobRole';
import type { Holiday, SpecialDay } from '../models/holiday';
import { checkStaffingForDate, wouldCauseShortage } from './staffingService';
import { formatDateLocal } from '../utils/dateUtils';
import { ROLES } from '../config/roles';

export interface AutoAssignResult {
  userId: string;
  userName: string;
  date: string;
  reason: string;
}

export interface AutoAssignPreview {
  assignments: AutoAssignResult[];
  totalAssigned: number;
  staffSummary: { userId: string; userName: string; daysAssigned: number; daysRemaining: number }[];
  warnings: string[];
}

/** Default regular days off per month per person */
const DAYS_OFF_PER_MONTH = 6;

/** Each user's quota = their override if set, else the default. */
function quotaFor(user: StaffUser): number {
  const o = user.regularOverride;
  return o != null && o >= 0 ? o : DAYS_OFF_PER_MONTH;
}

function getFirstSunday(year: number, month: number): string {
  for (let d = 1; d <= 7; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0) {
      return formatDateLocal(date);
    }
  }
  return '';
}

export function runAutoAssignment(
  users: StaffUser[],
  requests: LeaveRequest[],
  staffingRules: StaffingRule[],
  roleAssignments: StaffRoleAssignment[],
  holidays: Holiday[],
  specialDays: SpecialDay[],
  roleNames: Record<string, string>,
  cycleStart: string,
  cycleEnd: string,
): AutoAssignPreview {
  const warnings: string[] = [];
  const assignments: AutoAssignResult[] = [];
  const activeUsers = users.filter((u) => u.isActive && u.role !== ROLES.SPECTATOR);

  const startDate = new Date(cycleStart + 'T00:00:00');
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  const allDates: string[] = [];
  const current = new Date(cycleStart + 'T00:00:00');
  const endDate = new Date(cycleEnd + 'T00:00:00');
  while (current <= endDate) {
    allDates.push(formatDateLocal(current));
    current.setDate(current.getDate() + 1);
  }

  const holidaySet = new Set(holidays.map((h) => h.date));
  const specialSet = new Set(specialDays.map((s) => s.date));

  const simulatedRequests = [...requests];

  // Step 1: Count existing approved days per person.
  const userDaysOff: Record<string, number> = {};
  for (const user of activeUsers) {
    const existing = simulatedRequests.filter(
      (r) => r.userId === user.id && r.date >= cycleStart && r.date <= cycleEnd
        && r.status === 'approved' && r.leaveType === 'regular_day_off'
    ).length;
    userDaysOff[user.id] = existing;
  }

  // Step 2: First Sunday — everyone off, UNLESS already at quota.
  const firstSunday = getFirstSunday(year, month);
  if (firstSunday && allDates.includes(firstSunday)) {
    for (const user of activeUsers) {
      if ((userDaysOff[user.id] ?? 0) >= quotaFor(user)) continue;
      const alreadyOff = simulatedRequests.some(
        (r) => r.userId === user.id && r.date === firstSunday && r.status === 'approved'
      );
      if (!alreadyOff) {
        const mockReq: LeaveRequest = {
          id: `auto_sun_${user.id}_${firstSunday}`,
          userId: user.id,
          userRef: { id: user.id, displayName: user.displayName, role: user.role },
          date: firstSunday,
          leaveType: 'regular_day_off',
          status: 'approved',
          staffNote: 'First Sunday — all off',
          approverNote: 'Auto', decidedBy: null, decidedAt: null,
          isOverridden: false, overriddenBy: null, overriddenAt: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        assignments.push({
          userId: user.id, userName: user.displayName,
          date: firstSunday, reason: 'First Sunday — all off',
        });
        simulatedRequests.push(mockReq);
        userDaysOff[user.id] = (userDaysOff[user.id] ?? 0) + 1;
      }
    }
  }

  // Step 3: Build eligible dates.
  const eligibleDates = allDates.filter((d) =>
    !holidaySet.has(d) && !specialSet.has(d) && d !== firstSunday
  );

  // Step 4: Round-robin assignment up to each person's quota.
  const MAX_ROUNDS = 10;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const shuffled = [...activeUsers].sort(() => Math.random() - 0.5);

    for (const user of shuffled) {
      const currentOff = userDaysOff[user.id] ?? 0;
      if (currentOff >= quotaFor(user)) continue;

      const candidates: { date: string; score: number }[] = [];

      for (const d of eligibleDates) {
        const alreadyOff = simulatedRequests.some(
          (r) => r.userId === user.id && r.date === d && r.status === 'approved'
        );
        if (alreadyOff) continue;

        const offCount = simulatedRequests.filter(
          (r) => r.date === d && r.status === 'approved'
        ).length;

        const approvedOnDate = simulatedRequests.filter(
          (r) => r.date === d && r.status === 'approved'
        );
        const mockReq: LeaveRequest = {
          id: `auto_check_${user.id}_${d}`,
          userId: user.id,
          userRef: { id: user.id, displayName: user.displayName, role: user.role },
          date: d, leaveType: 'regular_day_off', status: 'approved',
          staffNote: '', approverNote: '', decidedBy: null, decidedAt: null,
          isOverridden: false, overriddenBy: null, overriddenAt: null,
          createdAt: '', updatedAt: '',
        };
        const statuses = checkStaffingForDate(d, staffingRules, roleAssignments, [...approvedOnDate, mockReq], roleNames);
        const { hasShortage } = wouldCauseShortage(statuses);
        if (hasShortage) continue;

        let score = offCount * 10;

        const userDates = simulatedRequests
          .filter((r) => r.userId === user.id && r.status === 'approved')
          .map((r) => r.date);
        for (const ud of userDates) {
          const diff = Math.abs(
            (new Date(d + 'T00:00:00').getTime() - new Date(ud + 'T00:00:00').getTime()) / 86400000
          );
          if (diff <= 1) score += 50;
          else if (diff <= 2) score += 20;
          else if (diff <= 3) score += 5;
        }

        score += Math.random() * 5;
        candidates.push({ date: d, score });
      }

      if (candidates.length === 0) {
        if (currentOff < quotaFor(user)) {
          warnings.push(`${user.displayName}: couldn't place day ${currentOff + 1}/${quotaFor(user)} without breaking staffing`);
        }
        continue;
      }

      candidates.sort((a, b) => a.score - b.score);
      const picked = candidates[0];

      const finalReq: LeaveRequest = {
        id: `auto_${user.id}_${picked.date}`,
        userId: user.id,
        userRef: { id: user.id, displayName: user.displayName, role: user.role },
        date: picked.date, leaveType: 'regular_day_off', status: 'approved',
        staffNote: 'Auto-assigned', approverNote: 'Auto', decidedBy: null, decidedAt: null,
        isOverridden: false, overriddenBy: null, overriddenAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      simulatedRequests.push(finalReq);
      assignments.push({
        userId: user.id, userName: user.displayName,
        date: picked.date, reason: `Round ${round + 1}`,
      });
      userDaysOff[user.id] = (userDaysOff[user.id] ?? 0) + 1;
    }
  }

  const staffSummary = activeUsers.map((u) => {
    const total = userDaysOff[u.id] ?? 0;
    const assigned = assignments.filter((a) => a.userId === u.id).length;
    return {
      userId: u.id, userName: u.displayName,
      daysAssigned: assigned, daysRemaining: Math.max(0, quotaFor(u) - total),
    };
  });

  return {
    assignments: assignments.sort((a, b) => a.date.localeCompare(b.date)),
    totalAssigned: assignments.length,
    staffSummary,
    warnings,
  };
}
EOF
echo "    wrote src/services/autoAssignService.ts"

echo "OUTER_MARKER_DONE_PART2"

############################################################
# 5. LeaveContext.tsx  (override threading + brace-bug fix)
############################################################
cat > "$ROOT/src/context/LeaveContext.tsx" << 'EOF'
import {
  createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode,
} from 'react';
import type { LeaveRequest, LeaveType, LeaveStatus } from '../models/leave';
import { LEAVE_TYPE_LABELS } from '../models/leave';
import type { LeaveBalance } from '../models/balance';
import type { UserRef } from '../models/user';
import { computeBalance } from '../services/balanceService';
import {
  fetchLeaveRequests, insertLeaveRequest, updateLeaveRequestDb, insertAuditLog,
} from '../services/supabaseService';
import {
  CYCLE_LENGTH_DAYS as _CYCLE_LENGTH_DAYS, VACATION_ACCRUAL_PER_MONTH,
  isFirstSundayOfMonth, normalizeDateStr,
} from '../models/validation';
import { formatDateLocal } from '../utils/dateUtils';
import { getCycleForDate as getNewCycle } from '../utils/cycleUtils';
import { useAppData } from './AppDataContext';
import { checkStaffingBeforeSubmit } from '../services/staffingCheckOnSubmit';

interface LeaveContextValue {
  requests: LeaveRequest[];
  loading: boolean;
  submitRequest: (userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note?: string) => Promise<string | null>;
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
    (async () => {
      setLoading(true);
      const data = await fetchLeaveRequests();
      setRequests(data as LeaveRequest[]);
      setLoading(false);
    })();
  }, []);

  const submitRequest = useCallback(async (
    userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note: string = '',
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

    const id = await insertLeaveRequest({
      userId, userDisplayName: userRef.displayName, userRole: userRef.role,
      date: normalizedDate, leaveType, status: 'pending', staffNote: note,
    });

    const newRequest: LeaveRequest = {
      id, userId, userRef, date: normalizedDate, leaveType,
      status: 'pending', staffNote: note, approverNote: '',
      decidedBy: null, decidedAt: null,
      isOverridden: false, overriddenBy: null, overriddenAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setRequests((prev) => [newRequest, ...prev]);

    await insertAuditLog({
      actorId: userId, actorName: userRef.displayName,
      action: 'leave_requested', entityType: 'leave_request', entityId: id,
      description: `${userRef.displayName} requested ${LEAVE_TYPE_LABELS[leaveType] ?? leaveType} for ${new Date(normalizedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    });

    return null;
  }, [requests, users, staffingRules, roleAssignments, jobRoles]);

  const cancelRequest = useCallback((requestId: string) => {
    setRequests((prev) => prev.map((r) =>
      r.id === requestId ? { ...r, status: 'cancelled' as LeaveStatus, updatedAt: new Date().toISOString() } : r,
    ));
    updateLeaveRequestDb(requestId, { status: 'cancelled' });
  }, []);

  const approve = useCallback((requestId: string, approver: UserRef, note: string = '') => {
    const now = new Date().toISOString();
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;
    const staffName = req.userRef.displayName ?? 'Unknown';
    const dateLabel = new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const typeLabel = LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType;

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

    updateLeaveRequestDb(requestId, {
      status: 'approved', decidedById: approver.id, decidedByName: approver.displayName,
      decidedAt: now, approverNote: note,
    });
    insertAuditLog({
      actorId: approver.id, actorName: approver.displayName,
      action: 'leave_approved', entityType: 'leave_request', entityId: requestId,
      description: `${approver.displayName} approved ${staffName}'s ${typeLabel} for ${dateLabel}`,
    });
  }, [requests]);

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
    updateLeaveRequestDb(requestId, {
      status: 'rejected', decidedById: approver.id, decidedByName: approver.displayName,
      decidedAt: now, approverNote: note,
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
    updateLeaveRequestDb(requestId, {
      status: newStatus, isOverridden: true,
      overriddenById: admin.id, overriddenByName: admin.displayName,
      overriddenAt: now, approverNote: note,
    });
    insertAuditLog({
      actorId: admin.id, actorName: admin.displayName,
      action: 'leave_overridden', entityType: 'leave_request', entityId: requestId,
      description: `${admin.displayName} overrode ${(() => { const r = requests.find((x) => x.id === requestId); return r ? r.userRef.displayName + "'s request" : 'a request'; })()} to ${newStatus}`,
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
      userId: targetUserId, userDisplayName: targetUserName, userRole: targetUserRole,
      date: normalizedDate, leaveType, status: 'approved',
      approverNote: `Directly assigned by ${adminName} (admin bypass)`,
    });

    setRequests((prev) => {
      const updated = prev.map((r) =>
        r.userId === targetUserId && r.date === normalizedDate && r.status !== 'cancelled'
          ? { ...r, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : r,
      );
      const newEntry: LeaveRequest = {
        id, userId: targetUserId,
        userRef: { id: targetUserId, displayName: targetUserName, role: targetUserRole },
        date: normalizedDate, leaveType, status: 'approved',
        staffNote: '', approverNote: `Directly assigned by ${adminName} (admin bypass)`,
        decidedBy: null, decidedAt: new Date().toISOString(),
        isOverridden: false, overriddenBy: null, overriddenAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      return [newEntry, ...updated];
    });

    await insertAuditLog({
      actorId: 'admin', actorName: adminName,
      action: 'leave_approved', entityType: 'leave_request', entityId: id,
      description: `${adminName} directly assigned ${LEAVE_TYPE_LABELS[leaveType] ?? leaveType} to ${targetUserName} for ${new Date(normalizedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    });
    return null;
  }, [requests]);

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

function getVacationAccrual(userId: string, users: { id: string; createdAt: string; vacationOverride?: number | null }[]): number {
  const user = users.find((u) => u.id === userId);
  if (!user) return 0;
  if (user.vacationOverride != null && user.vacationOverride >= 0) return user.vacationOverride;
  const start = new Date(user.createdAt);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  return months * VACATION_ACCRUAL_PER_MONTH;
}
EOF
echo "    wrote src/context/LeaveContext.tsx"

echo "OUTER_MARKER_DONE_PART3"

############################################################
# 6. VacationAdjustment.tsx  (combined vacation + days-off editor)
############################################################
cat > "$ROOT/src/pages/admin/VacationAdjustment.tsx" << 'EOF'
import { useState } from 'react';
import { Card, Badge, Button, Modal, FormInput } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { useLeave } from '../../context/LeaveContext';
import { useAuth } from '../../context/AuthContext';
import { insertAuditLog, updateUserDb } from '../../services/supabaseService';

interface Props { onBack: () => void }

export default function VacationAdjustment({ onBack }: Props) {
  const { user } = useAuth();
  const { users } = useAppData();
  const { getBalance } = useLeave();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [regularValue, setRegularValue] = useState('');
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const allUsers = users.filter((u) => u.isActive);
  const selected = allUsers.find((u) => u.id === selectedUser);
  const balance = selectedUser ? getBalance(selectedUser) : null;

  const handleAdjust = async () => {
    if (!selectedUser || !reason.trim() || !selected) return;
    const vacProvided = adjustValue !== '';
    const regProvided = regularValue !== '';
    if (!vacProvided && !regProvided) return;

    const payload: Record<string, unknown> = {};
    let desc = '';

    if (vacProvided) {
      const newVac = Number(adjustValue);
      if (isNaN(newVac) || newVac < 0) return;
      payload.vacation_override = newVac;
      desc += `Vacation ${balance?.vacationDaysTotal ?? 0} -> ${newVac}. `;
    }
    if (regProvided) {
      const newReg = Number(regularValue);
      if (isNaN(newReg) || newReg < 0) return;
      payload.regular_override = newReg;
      desc += `Days-off allowance ${balance?.regularDaysAllowed ?? 6} -> ${newReg}. `;
    }

    await updateUserDb(selectedUser, payload);

    await insertAuditLog({
      actorId: user?.id ?? 'admin',
      actorName: user?.displayName ?? 'Admin',
      action: 'balance_adjusted',
      entityType: 'balance',
      entityId: selectedUser,
      description: `Adjusted ${selected.displayName}: ${desc}Reason: ${reason}`,
    });

    setDone(true);
    setTimeout(() => {
      setDone(false); setShowConfirm(false); setAdjustValue(''); setRegularValue(''); setReason('');
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>&larr; Back</button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Leave Allowances</h2>
      </div>

      <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
        Select a person to adjust their vacation balance and/or day-off allowance.
      </p>

      <div className="space-y-2">
        {allUsers.map((u) => {
          const bal = getBalance(u.id);
          const isSelected = selectedUser === u.id;
          return (
            <button key={u.id} onClick={() => setSelectedUser(isSelected ? null : u.id)} className="w-full text-left cursor-pointer">
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: theme.colors.primary + '20', color: theme.colors.primaryLight }}>
                      {u.displayName[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{u.displayName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: theme.colors.warning }}>{bal.vacationDaysRemaining}</p>
                    <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>of {bal.vacationDaysTotal}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>Regular Days Left</p>
                        <p className="text-sm font-bold" style={{ color: theme.colors.primary }}>{bal.regularDaysRemaining} / {bal.regularDaysAllowed}</p>
                      </div>
                      <div>
                        <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>Vacation Left</p>
                        <p className="text-sm font-bold" style={{ color: theme.colors.warning }}>{bal.vacationDaysRemaining} / {bal.vacationDaysTotal}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" fullWidth onClick={(e) => { e.stopPropagation(); setAdjustValue(String(bal.vacationDaysTotal)); setRegularValue(String(bal.regularDaysAllowed)); setShowConfirm(true); }}>
                      Adjust Allowances
                    </Button>
                  </div>
                )}
              </Card>
            </button>
          );
        })}
      </div>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title={`Adjust: ${selected?.displayName ?? ''}`}
        footer={!done ? <><Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAdjust} disabled={(!adjustValue && !regularValue) || !reason.trim()}>Confirm</Button></> : undefined}>
        {done ? (
          <div className="flex items-center gap-2"><Badge color="success">Done</Badge>
            <span className="text-xs" style={{ color: theme.colors.success }}>Allowances adjusted</span></div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: theme.colors.gray }}>
              Current vacation total: <strong>{balance?.vacationDaysTotal ?? 0}</strong> days &middot;
              Current day-off allowance: <strong>{balance?.regularDaysAllowed ?? 6}</strong> per cycle
            </p>
            <FormInput label="Vacation Total (days)" type="number" placeholder="e.g. 14"
              value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
            <FormInput label="Day-Off Allowance (per cycle)" type="number" placeholder="e.g. 6"
              value={regularValue} onChange={(e) => setRegularValue(e.target.value)} />
            <FormInput label="Reason (required)" placeholder="Why is this adjustment needed?"
              value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-[10px]" style={{ color: theme.colors.warning }}>
              Leave a field blank to keep it unchanged. This action is logged in the audit trail.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
EOF
echo "    wrote src/pages/admin/VacationAdjustment.tsx"

echo "OUTER_MARKER_DONE_PART4"

############################################################
# 7. UserManagement.tsx  (spectator option + safe Remove)
############################################################
cat > "$ROOT/src/pages/admin/UserManagement.tsx" << 'EOF'
import { useState } from 'react';
import { Card, Badge, Button, Modal, FormInput, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLES, ROLE_LABELS, ROLE_BADGE_COLOR, type Role } from '../../config/roles';

interface Props { onBack: () => void }

export default function UserManagement({ onBack }: Props) {
  const { user } = useAuth();
  const {
    users, addUser, updateUser,
    jobRoles, roleAssignments, assignRole, removeRoleAssignment,
  } = useAppData();

  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingRolesFor, setEditingRolesFor] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<Role>(ROLES.STAFF);
  const [formJobRoles, setFormJobRoles] = useState<Set<string>>(new Set());
  const [formPrimaryRole, setFormPrimaryRole] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [formDaysOff, setFormDaysOff] = useState(6);
  const [formAutoAssign, setFormAutoAssign] = useState(true);

  const resetForm = () => {
    setFormName(''); setFormUsername(''); setFormPin('');
    setFormRole(ROLES.STAFF); setFormJobRoles(new Set());
    setFormPrimaryRole(''); setFormError('');
    setFormDaysOff(6); setFormAutoAssign(true);
  };

  const toggleJobRole = (roleId: string) => {
    setFormJobRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) { next.delete(roleId); if (formPrimaryRole === roleId) setFormPrimaryRole(''); }
      else { next.add(roleId); if (next.size === 1) setFormPrimaryRole(roleId); }
      return next;
    });
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formUsername.trim()) { setFormError('Name and username required'); return; }
    if (formPin.length < 4) { setFormError('PIN must be 4+ digits'); return; }
    if (users.some((u) => u.username.toLowerCase() === formUsername.trim().toLowerCase())) {
      setFormError('Username already exists'); return;
    }
    if (formRole !== ROLES.SPECTATOR && formJobRoles.size === 0) { setFormError('Select at least one job role'); return; }

    await addUser({
      username: formUsername.trim().toLowerCase(),
      displayName: formName.trim(),
      pin: formPin,
      role: formRole,
      isActive: true,
    }, user?.displayName ?? 'Admin');

    setTimeout(async () => {
      const { data: latestUsers } = await supabase.from('users').select('id, username').eq('username', formUsername.trim().toLowerCase());
      const created = latestUsers?.[0];
      if (created) {
        for (const roleId of formJobRoles) {
          assignRole(created.id, roleId, roleId === formPrimaryRole);
        }
      }
    }, 500);

    resetForm();
    setShowAdd(false);
  };

  // Safe remove: deactivate + strip all job-role assignments.
  // Keeps history, avoids foreign-key errors from a hard delete.
  const handleDelete = async (id: string) => {
    await updateUser(id, { isActive: false }, user?.displayName ?? 'Admin');
    roleAssignments
      .filter((a) => a.userId === id)
      .forEach((a) => removeRoleAssignment(a.id));
    setConfirmDelete(null);
  };

  const getUserJobRoles = (userId: string) => {
    return roleAssignments
      .filter((a) => a.userId === userId)
      .map((a) => ({
        ...a,
        roleName: jobRoles.find((r) => r.id === a.jobRoleId)?.name ?? a.jobRoleId,
        roleColor: jobRoles.find((r) => r.id === a.jobRoleId)?.color ?? '#666',
      }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>&larr; Back</button>
          <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Users ({users.length})</h2>
        </div>
        <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => setShowAdd(true)}>Add</Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => {
          const userRoles = getUserJobRoles(u.id);
          return (
            <Card key={u.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: theme.colors.primary + '20', color: theme.colors.primaryLight }}>
                    {u.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{u.displayName}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>{u.username}</span>
                      <Badge color={ROLE_BADGE_COLOR[u.role]} size="xs">{ROLE_LABELS[u.role]}</Badge>
                      {!u.isActive && <Badge color="danger" size="xs">Inactive</Badge>}
                    </div>
                    {userRoles.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {userRoles.map((r) => (
                          <span key={r.id} className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: r.roleColor + '20', color: r.roleColor }}>
                            {r.roleName}{r.isPrimary ? ' \u2605' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditingRolesFor(editingRolesFor === u.id ? null : u.id)}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{ color: theme.colors.primary, backgroundColor: theme.colors.bgCard }}>Roles</button>
                  <button onClick={() => updateUser(u.id, { isActive: !u.isActive }, user?.displayName ?? 'Admin')}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{ color: u.isActive ? theme.colors.warning : theme.colors.success, backgroundColor: theme.colors.bgCard }}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => setConfirmDelete(u.id)}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{ color: theme.colors.danger, backgroundColor: theme.colors.bgCard }}>Remove</button>
                </div>
              </div>

              {editingRolesFor === u.id && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.colors.grayDark }}>
                    Assign Job Roles
                  </p>
                  <div className="space-y-1">
                    {jobRoles.map((jr) => {
                      const assigned = roleAssignments.find((a) => a.userId === u.id && a.jobRoleId === jr.id);
                      return (
                        <div key={jr.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ backgroundColor: assigned ? jr.color + '10' : theme.colors.bgCard,
                            border: `1px solid ${assigned ? jr.color + '40' : theme.colors.border}` }}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jr.color }} />
                            <span className="text-xs" style={{ color: theme.colors.white }}>
                              {jr.name} {jr.isHidden && <span style={{ color: theme.colors.grayDark }}>(hidden)</span>}
                            </span>
                          </div>
                          {assigned ? (
                            <button onClick={() => removeRoleAssignment(assigned.id)}
                              className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
                              style={{ color: theme.colors.danger, backgroundColor: theme.colors.bgCard }}>Remove</button>
                          ) : (
                            <button onClick={() => assignRole(u.id, jr.id, false)}
                              className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
                              style={{ color: theme.colors.primary, backgroundColor: theme.colors.bgCard }}>Assign</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Add User"
        footer={<><Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleAdd}>Create User</Button></>}>
        <FormInput label="Display Name" placeholder="Full name" value={formName} onChange={(e) => setFormName(e.target.value)} />
        <FormInput label="Username" placeholder="login username" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} />
        <FormInput label="PIN" type="password" placeholder="4+ digits" value={formPin}
          onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Access Level</label>
          <div className="flex gap-2 flex-wrap">
            {([ROLES.STAFF, ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.SPECTATOR] as Role[]).map((r) => (
              <button key={r} onClick={() => setFormRole(r)}
                className="flex-1 py-2 rounded-lg text-[10px] font-medium cursor-pointer"
                style={{
                  backgroundColor: formRole === r ? theme.colors.primary : theme.colors.bgCard,
                  color: formRole === r ? theme.colors.white : theme.colors.grayDark,
                  border: `1px solid ${formRole === r ? theme.colors.primary : theme.colors.border}`,
                }}>{ROLE_LABELS[r]}</button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>
            Job Roles <span style={{ color: theme.colors.grayDark }}>(what positions they work)</span>
          </label>
          <div className="space-y-1">
            {jobRoles.map((jr) => {
              const selected = formJobRoles.has(jr.id);
              return (
                <button key={jr.id} onClick={() => toggleJobRole(jr.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer"
                  style={{
                    backgroundColor: selected ? jr.color + '15' : theme.colors.bgCard,
                    border: `1px solid ${selected ? jr.color : theme.colors.border}`,
                  }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jr.color }} />
                    <span className="text-xs" style={{ color: theme.colors.white }}>{jr.name}</span>
                    {jr.isHidden && <span className="text-[9px]" style={{ color: theme.colors.grayDark }}>(hidden)</span>}
                  </div>
                  {selected && (
                    <button onClick={(e) => { e.stopPropagation(); setFormPrimaryRole(jr.id); }}
                      className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                      style={{
                        backgroundColor: formPrimaryRole === jr.id ? theme.colors.primary : theme.colors.bgCard,
                        color: formPrimaryRole === jr.id ? theme.colors.white : theme.colors.grayDark,
                        border: `1px solid ${formPrimaryRole === jr.id ? theme.colors.primary : theme.colors.border}`,
                      }}>
                      {formPrimaryRole === jr.id ? '\u2605 Primary' : 'Set Primary'}
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Day-Off Quota (this cycle)</label>
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={10} value={formDaysOff} onChange={(e) => setFormDaysOff(Number(e.target.value))}
              className="w-20 rounded-lg text-sm outline-none px-3 py-2 text-center"
              style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }} />
            <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>days off per cycle</span>
          </div>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={formAutoAssign} onChange={(e) => setFormAutoAssign(e.target.checked)} />
            <span className="text-[10px]" style={{ color: theme.colors.gray }}>Auto-assign days off for current cycle</span>
          </label>
        </div>
        {formError && <p className="text-xs" style={{ color: theme.colors.danger }}>{formError}</p>}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove User"
        footer={<><Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="secondary" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Remove</Button></>}>
        <p className="text-sm" style={{ color: theme.colors.gray }}>
          This deactivates the person and removes them from all schedules and the check-in board. Their past attendance history is kept. You can reactivate them later.
        </p>
      </Modal>
    </div>
  );
}
EOF
echo "    wrote src/pages/admin/UserManagement.tsx"

echo "OUTER_MARKER_DONE_PART5"

############################################################
# 8. SpectatorDashboard.tsx  (new file)
############################################################
cat > "$ROOT/src/pages/dashboards/SpectatorDashboard.tsx" << 'EOF'
import { useState } from 'react';
import { Card, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import AttendanceSummary from '../../components/AttendanceSummary';
import CheckInBoard from '../../components/CheckInBoard';
import ShiftStatusBoard from '../../components/ShiftStatusBoard';
import UserManagement from '../admin/UserManagement';
import VacationAdjustment from '../admin/VacationAdjustment';

type View = 'dashboard' | 'attendance' | 'checkins' | 'shiftStatus' | 'users' | 'allowances';

export default function SpectatorDashboard() {
  const { user } = useAuth();
  const { users } = useAppData();
  const [view, setView] = useState<View>('dashboard');

  if (view === 'checkins')
    return <CheckInBoard onBack={() => setView('dashboard')} currentUserRole={user?.role ?? 'spectator'} />;
  if (view === 'shiftStatus')
    return <ShiftStatusBoard onBack={() => setView('dashboard')} />;
  if (view === 'users')
    return <UserManagement onBack={() => setView('dashboard')} />;
  if (view === 'allowances')
    return <VacationAdjustment onBack={() => setView('dashboard')} />;
  if (view === 'attendance')
    return (
      <div className="space-y-3">
        <button onClick={() => setView('dashboard')} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>&larr; Back</button>
        <AttendanceSummary
          currentUserId={user?.id ?? ''}
          currentUserRole={user?.role ?? 'spectator'}
          currentUserJobRoles={user?.jobRole ?? []}
        />
      </div>
    );

  const tiles: { id: View; label: string; sub: string; icon: React.ReactNode }[] = [
    { id: 'checkins', label: 'Check-In Board', sub: 'Live check-in / out status', icon: Icons.users },
    { id: 'shiftStatus', label: 'Shift Status', sub: 'Who responded to shifts', icon: Icons.calendar },
    { id: 'attendance', label: 'Attendance', sub: 'Hours & attendance summary', icon: Icons.calendar },
    { id: 'users', label: 'Manage Users', sub: 'Add / remove, roles', icon: Icons.settings },
    { id: 'allowances', label: 'Leave Allowances', sub: 'Days off & vacation per person', icon: Icons.settings },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-base font-bold" style={{ color: theme.colors.white }}>
          Welcome, {user?.displayName}
        </p>
        <p className="text-xs mt-0.5" style={{ color: theme.colors.grayDark }}>
          Spectator &middot; view-only &middot; {users.length} users
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className="text-left rounded-xl p-4 cursor-pointer transition-all"
            style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}
          >
            <span style={{ color: theme.colors.primary }}>{t.icon}</span>
            <p className="text-sm font-semibold mt-2" style={{ color: theme.colors.white }}>{t.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>{t.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
EOF
echo "    wrote src/pages/dashboards/SpectatorDashboard.tsx"

############################################################
# 9. AppShell.tsx  (route spectator dashboard)
############################################################
cat > "$ROOT/src/components/layout/AppShell.tsx" << 'EOF'
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import TopBar from './TopBar';
import BottomNav, { type TabId } from './BottomNav';
import SuperAdminDashboard from '../../pages/dashboards/SuperAdminDashboard';
import ManagerDashboard from '../../pages/dashboards/ManagerDashboard';
import StaffDashboard from '../../pages/dashboards/StaffDashboard';
import SpectatorDashboard from '../../pages/dashboards/SpectatorDashboard';
import CalendarPage from '../../pages/CalendarPage';
import TaskBoard from '../../pages/TaskBoard';
import StaffPage from '../../pages/StaffPage';
import SettingsPage from '../../pages/SettingsPage';
import CycleManager from '../CycleManager';
import RoleGuard from '../guards/RoleGuard';
import { ROLES } from '../../config/roles';
import { ROLE_LABELS } from '../../config/roles';
import { theme } from '../../config/theme';

const TAB_TITLES: Record<TabId, string> = {
  home: 'Dashboard',
  tasks: 'Tasks',
  calendar: 'Calendar',
  staff: 'Staff',
  settings: 'Settings',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<TabId>('home');

  if (!user) return null;

  const dashboardByRole: Record<string, React.ReactNode> = {
    [ROLES.SUPER_ADMIN]: <SuperAdminDashboard />,
    [ROLES.MANAGER]: <ManagerDashboard />,
    [ROLES.STAFF]: <StaffDashboard />,
    [ROLES.SPECTATOR]: <SpectatorDashboard />,
  };

  const tabContent: Record<TabId, React.ReactNode> = {
    home: dashboardByRole[user.role],
    tasks: <TaskBoard />,
    calendar: <CalendarPage />,
    staff: (
      <RoleGuard allowed={[ROLES.SUPER_ADMIN, ROLES.MANAGER]}>
        <StaffPage />
      </RoleGuard>
    ),
    settings: <SettingsPage />,
  };

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: theme.colors.bg }}>
      <TopBar
        title={TAB_TITLES[tab]}
        subtitle={tab === 'home' ? ROLE_LABELS[user.role] : undefined}
        onLogout={logout}
      />
      <CycleManager />
      <main className="px-4 py-4 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
        {tabContent[tab]}
      </main>
      <BottomNav activeTab={tab} onTabChange={setTab} role={user.role} />
    </div>
  );
}
EOF
echo "    wrote src/components/layout/AppShell.tsx"

############################################################
# 10. BottomNav.tsx  (view-only nav for spectator)
############################################################
cat > "$ROOT/src/components/layout/BottomNav.tsx" << 'EOF'
import type { ReactNode } from 'react';
import { theme } from '../../config/theme';
import { ROLES, type Role } from '../../config/roles';
import { Icons } from '../ui';

export type TabId = 'home' | 'tasks' | 'calendar' | 'staff' | 'settings';

interface Tab { id: TabId; icon: ReactNode; label: string; }

interface BottomNavProps { activeTab: TabId; onTabChange: (tab: TabId) => void; role: Role; }

export default function BottomNav({ activeTab, onTabChange, role }: BottomNavProps) {
  const tabs: Tab[] = role === ROLES.SPECTATOR
    ? [
        { id: 'home', icon: Icons.home, label: 'Home' },
        { id: 'calendar', icon: Icons.calendar, label: 'Calendar' },
        { id: 'settings', icon: Icons.settings, label: 'Settings' },
      ]
    : [
        { id: 'home', icon: Icons.home, label: 'Home' },
        { id: 'tasks', icon: '\u{1F4CB}', label: 'Tasks' },
        { id: 'calendar', icon: Icons.calendar, label: 'Calendar' },
        ...(role !== ROLES.STAFF ? [{ id: 'staff' as TabId, icon: Icons.users, label: 'Staff' }] : []),
        { id: 'settings', icon: Icons.settings, label: 'Settings' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: theme.colors.bgElevated, borderTop: `1px solid ${theme.colors.border}` }}>
      <div className="flex items-center justify-around max-w-md mx-auto h-14">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => onTabChange(t.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 transition-all cursor-pointer">
              <span className="transition-colors" style={{ color: active ? theme.colors.primary : theme.colors.grayDark }}>{t.icon}</span>
              <span className="text-[10px] font-medium" style={{ color: active ? theme.colors.primary : theme.colors.grayDark }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
EOF
echo "    wrote src/components/layout/BottomNav.tsx"

echo ""
echo "==> All files written. Backup at: $BK"
echo "==> Running build to verify..."
echo ""
npm run build
RC=$?
echo ""
if [ $RC -eq 0 ]; then
  echo "============================================"
  echo " BUILD SUCCEEDED. Code changes are good."
  echo " Next: deploy, then flip Nabeel in Supabase."
  echo "============================================"
else
  echo "============================================"
  echo " BUILD FAILED (see errors above)."
  echo " Your originals are safe in: $BK"
  echo " To restore everything, run:"
  echo "   cp -r \"$BK\"/src \"$ROOT\"/"
  echo "============================================"
fi
