import type { LeaveRequest } from '../models/leave';
import type { StaffUser } from '../models/user';
import type { StaffingRule } from '../models/staffing';
import type { StaffRoleAssignment } from '../models/jobRole';
import type { JobRole } from '../models/jobRole';
import { LEAVE_TYPE_LABELS } from '../models/leave';
import { checkStaffingForDate, wouldCauseShortage } from './staffingService';
import { formatDateLocal } from '../utils/dateUtils';
import { ROLES } from '../config/roles';

/**
 * STATUS: SERVICE COMPLETE
 * Generates tomorrow's absence summary for the daily reminder.
 * Does not actually send notifications — that's handled by the caller.
 */

export interface TomorrowSummary {
  date: string;
  dateLabel: string;
  staffOff: { name: string; leaveType: string }[];
  staffCount: number;
  onDuty: number;
  shortages: { roleName: string; scheduled: number; required: number }[];
  pendingUrgent: number;
  message: string;
}

/**
 * Generate a summary of tomorrow's absences and staffing status.
 */
export function generateTomorrowSummary(
  requests: LeaveRequest[],
  users: StaffUser[],
  staffingRules: StaffingRule[],
  roleAssignments: StaffRoleAssignment[],
  jobRoles: JobRole[],
): TomorrowSummary {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateLocal(tomorrow);
  const dateLabel = tomorrow.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const activeStaff = users.filter((u) => u.role === ROLES.STAFF && u.isActive);
  const staffCount = activeStaff.length;

  // Who's off tomorrow
  const approvedTomorrow = requests.filter(
    (r) => r.date === tomorrowStr && r.status === 'approved',
  );
  const staffOff = approvedTomorrow.map((r) => ({
    name: r.userRef?.displayName ?? 'Unknown User',
    leaveType: LEAVE_TYPE_LABELS[r.leaveType],
  }));

  const onDuty = staffCount - staffOff.length;

  // Staffing check
  const roleNames: Record<string, string> = {};
  for (const r of jobRoles) roleNames[r.id] = r.name;

  const statuses = checkStaffingForDate(
    tomorrowStr, staffingRules, roleAssignments, approvedTomorrow, roleNames,
  );
  const { warnings } = wouldCauseShortage(statuses);
  const shortages = warnings
    .filter((s) => s.surplus < 0)
    .map((s) => ({
      roleName: s.jobRoleName,
      scheduled: s.scheduled,
      required: s.required,
    }));

  // Pending urgent (requests for tomorrow still pending)
  const pendingUrgent = requests.filter(
    (r) => r.date === tomorrowStr && r.status === 'pending',
  ).length;

  // Build message
  let message = `Tomorrow (${dateLabel}): `;
  if (staffOff.length === 0) {
    message += 'Full team on duty.';
  } else {
    message += `${staffOff.length} off, ${onDuty} on duty.`;
    if (shortages.length > 0) {
      message += ` ⚠️ ${shortages.length} role(s) below minimum!`;
    }
  }
  if (pendingUrgent > 0) {
    message += ` ${pendingUrgent} pending request(s) need attention.`;
  }

  return {
    date: tomorrowStr,
    dateLabel,
    staffOff,
    staffCount,
    onDuty,
    shortages,
    pendingUrgent,
    message,
  };
}
