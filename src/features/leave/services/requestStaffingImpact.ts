import type { LeaveRequest } from '@/models/leave';
import type { StaffingRule } from '@/models/staffing';
import type { StaffRoleAssignment } from '@/models/jobRole';
import { checkStaffingForDate, getUserJobRoleIds, scopeStatusesToRoles, wouldCauseShortage } from '@/services/staffingService';

export function requestStaffingImpact(
  request: LeaveRequest,
  requests: LeaveRequest[],
  rules: StaffingRule[],
  assignments: StaffRoleAssignment[],
  roleNames: Record<string, string>,
) {
  const approvedOnDate = requests.filter((r) => r.date === request.date && r.status === 'approved' && r.id !== request.id);
  const withApproval = scopeStatusesToRoles(
    checkStaffingForDate(request.date, rules, assignments, [...approvedOnDate, request], roleNames),
    getUserJobRoleIds(request.userId, assignments),
  );
  const { hasShortage, hasHardBlock } = wouldCauseShortage(withApproval);
  const level: 'safe' | 'warning' | 'danger' = hasHardBlock ? 'danger' : hasShortage ? 'warning' : 'safe';
  return { withApproval, level, hasHardBlock };
}
