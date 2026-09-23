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
  // ========== CRITICAL Check 0: Enforce Minimum 2 Working Staff Per Role ==========
  // RULE: At least 2 staff members must ALWAYS remain working in any role
  // This is a HARD CONSTRAINT: working_staff_remaining >= 2, always
  const userJobRoleIds = getUserJobRoleIds(userId, roleAssignments);
  for (const jobRoleId of userJobRoleIds) {
    // Count TOTAL employees assigned to this job role
    const totalStaffInRole = roleAssignments.filter(
      (a) => a.jobRoleId === jobRoleId
    ).length;

    // Count staff already on leave (approved) for this date
    const alreadyOnLeave = requests
      .filter(r =>
        r.date === date &&
        r.status === 'approved'
      )
      .filter(r => {
        const theirRoles = getUserJobRoleIds(r.userId, roleAssignments);
        return theirRoles.includes(jobRoleId);
      }).length;

    // If this user takes leave, how many would remain working?
    const wouldRemainWorking = totalStaffInRole - alreadyOnLeave - 1;

    const jobRoleName = jobRoles.find(jr => jr.id === jobRoleId)?.name || jobRoleId;

    // HARD BLOCK: If remaining would be < 2, reject the request
    if (wouldRemainWorking < 2) {
      return `❌ BLOCKED: Role "${jobRoleName}" would have only ${wouldRemainWorking} staff working on ${date}. Minimum 2 must always be present. Request denied.`;
    }
  }

  // ========== Check 1: Job Role Daily Limit (Max 2 per role per day) ==========
  for (const jobRoleId of userJobRoleIds) {
    // Count how many approved/pending requests already exist for this date with this same job role
    const otherStaffOnDateWithRole = requests
      .filter(r =>
        r.date === date &&
        r.userId !== userId &&
        (r.status === 'approved' || r.status === 'pending')
      )
      .filter(r => {
        // Check if this other staff member has the same job role
        const theirRoles = getUserJobRoleIds(r.userId, roleAssignments);
        return theirRoles.includes(jobRoleId);
      });

    // If 2 or more staff with this role already have leave on this date, block this request
    if (otherStaffOnDateWithRole.length >= 2) {
      const jobRoleName = jobRoles.find(jr => jr.id === jobRoleId)?.name || jobRoleId;
      return `Maximum 2 staff with role "${jobRoleName}" can take leave on this date. The limit has been reached.`;
    }
  }

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
