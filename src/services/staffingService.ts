import type { StaffingRule, StaffingStatus } from '../models/staffing';
import type { StaffRoleAssignment } from '../models/jobRole';
import type { LeaveRequest } from '../models/leave';

/** Every job role a given user is assigned to. */
export function getUserJobRoleIds(userId: string, roleAssignments: StaffRoleAssignment[]): string[] {
  return roleAssignments.filter((a) => a.userId === userId).map((a) => a.jobRoleId);
}

/**
 * Narrow a set of per-role staffing statuses down to only the roles a specific
 * person belongs to. Use this before wouldCauseShortage() whenever the question
 * is "does THIS person's request break THEIR OWN department's coverage" —
 * otherwise an unrelated department that's already short-staffed that day will
 * wrongly block a request that has nothing to do with it.
 */
export function scopeStatusesToRoles(statuses: StaffingStatus[], roleIds: string[]): StaffingStatus[] {
  return statuses.filter((s) => roleIds.includes(s.jobRoleId));
}

/**
 * STATUS: SERVICE PLACEHOLDER
 * Pure functions. No database.
 */

/**
 * Check staffing impact for a specific date.
 * Returns staffing status for each role that has a minimum rule.
 */
export function checkStaffingForDate(
  date: string,
  rules: StaffingRule[],
  allAssignments: StaffRoleAssignment[],
  approvedLeavesOnDate: LeaveRequest[],
  roleNames: Record<string, string>,
): StaffingStatus[] {
  const dayOfWeek = (new Date(date + 'T00:00:00').getDay() + 6) % 7; // Mon=0

  // Get users who are off on this date
  const usersOff = new Set(approvedLeavesOnDate.map((r) => r.userId));

  return rules
    .filter((r) => r.dayOfWeek === null || r.dayOfWeek === dayOfWeek)
    .map((rule) => {
      // Count how many people with this role are scheduled (not off)
      const assignedUsers = allAssignments.filter(
        (a) => a.jobRoleId === rule.jobRoleId,
      );
      const scheduled = assignedUsers.filter(
        (a) => !usersOff.has(a.userId),
      ).length;

      return {
        date,
        jobRoleId: rule.jobRoleId,
        jobRoleName: roleNames[rule.jobRoleId] ?? rule.jobRoleId,
        required: rule.minimumRequired,
        scheduled,
        surplus: scheduled - rule.minimumRequired,
        enforcement: rule.enforcement,
      };
    });
}

/**
 * Check if approving a leave request would cause any staffing shortage.
 *
 * surplus < 0 → BELOW minimum (actual shortage)
 * surplus === 0 → AT minimum (warning, but not a shortage)
 * surplus > 0 → above minimum (safe)
 */
export function wouldCauseShortage(
  statuses: StaffingStatus[],
): { hasShortage: boolean; hasHardBlock: boolean; warnings: StaffingStatus[] } {
  // Below minimum = actual shortage
  const belowMinimum = statuses.filter((s) => s.surplus < 0);
  // At minimum = tight but not broken
  const atMinimum = statuses.filter((s) => s.surplus === 0);
  // Hard block only triggers when actually below minimum
  const hasHardBlock = belowMinimum.some((s) => s.enforcement === 'hard_block');

  return {
    hasShortage: belowMinimum.length > 0,
    hasHardBlock,
    warnings: [...belowMinimum, ...atMinimum],
  };
}
