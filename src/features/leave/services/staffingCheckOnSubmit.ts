import { checkStaffingForDate, wouldCauseShortage, getUserJobRoleIds, scopeStatusesToRoles } from '@/services/staffingService';
import type { StaffingRule } from '@/models/staffing';
import type { StaffRoleAssignment } from '@/models/jobRole';
import type { LeaveRequest } from '@/models/leave';

export function checkStaffingBeforeSubmit(
  date: string,
  userId: string,
  requests: LeaveRequest[],
  staffingRules: StaffingRule[],
  roleAssignments: StaffRoleAssignment[],
  jobRoles: { id: string; name: string }[],
): string | null {
  // ========== Check 2: Minimum Staffing Requirements ==========
  if (staffingRules.length === 0) return null;
  const approvedOnDate = requests.filter(r => r.date === date && r.status === 'approved');
  const simulatedOff = [...approvedOnDate, { userId, date } as LeaveRequest];
  const roleNameMap: Record<string, string> = {};
  for (const r of jobRoles) roleNameMap[r.id] = r.name;
  const statuses = checkStaffingForDate(date, staffingRules, roleAssignments, simulatedOff, roleNameMap);
  // Only this person's own job role(s) can be affected by their own request —
  // an unrelated department's shortage must never block them.
  const myRoleIds = getUserJobRoleIds(userId, roleAssignments);
  const myStatuses = scopeStatusesToRoles(statuses, myRoleIds);
  const impact = wouldCauseShortage(myStatuses);
  if (impact.hasHardBlock) {
    const roles = impact.warnings.filter(w => w.surplus < 0).map(w => w.jobRoleName).join(', ');
    return 'Cannot request — minimum staffing not met for: ' + roles;
  }
  return null;
}
