import type { LeaveRequest } from '../models/leave';
import type { StaffUser } from '../models/user';
import type { StaffingRule } from '../models/staffing';
import type { StaffRoleAssignment } from '../models/jobRole';
import type { Holiday, SpecialDay } from '../models/holiday';
import { checkStaffingForDate, wouldCauseShortage, getUserJobRoleIds, scopeStatusesToRoles } from './staffingService';
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
          userId: user.id, userName: user.displayName ?? user.username ?? 'Unknown User',
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

      // Only this person's own job role(s) can be broken by their own day off —
      // another department already short-staffed that day must not rule out a date for them.
      const userRoleIds = getUserJobRoleIds(user.id, roleAssignments);

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
        const myStatuses = scopeStatusesToRoles(statuses, userRoleIds);
        const { hasShortage } = wouldCauseShortage(myStatuses);
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
          warnings.push(`${user.displayName ?? user.username ?? 'Unknown User'}: couldn't place day ${currentOff + 1}/${quotaFor(user)} without breaking staffing`);
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
        userId: user.id, userName: user.displayName ?? user.username ?? 'Unknown User',
        date: picked.date, reason: `Round ${round + 1}`,
      });
      userDaysOff[user.id] = (userDaysOff[user.id] ?? 0) + 1;
    }
  }

  const staffSummary = activeUsers.map((u) => {
    const total = userDaysOff[u.id] ?? 0;
    const assigned = assignments.filter((a) => a.userId === u.id).length;
    return {
      userId: u.id, userName: u.displayName ?? u.username ?? 'Unknown User',
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
