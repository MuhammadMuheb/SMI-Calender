/**
 * Department Leave Limit Validation Service
 *
 * Validates leave requests against department capacity limits.
 * Implements first-come, first-served logic to enforce max leave per day per department.
 */

import type { LeaveRequest } from '../models/leave';
import type { StaffRoleAssignment } from '../models/jobRole';
import type { DepartmentLeaveLimit, LeaveValidationResult } from '../models/departmentLeaveLimit';

/**
 * Check if a leave request would exceed department limits
 *
 * @param userId - Staff member requesting leave
 * @param date - Leave request date (YYYY-MM-DD)
 * @param roleAssignments - All staff role assignments
 * @param leaveRequests - All leave requests in system
 * @param departmentLimits - Configured limits per department
 * @returns Validation result with allowed boolean and details
 */
export function validateLeaveRequestAgainstDepartmentLimits(
  userId: string,
  date: string,
  roleAssignments: StaffRoleAssignment[],
  leaveRequests: LeaveRequest[],
  departmentLimits: DepartmentLeaveLimit[],
): LeaveValidationResult {
  // 1. Find user's primary role/department
  const userPrimaryRole = roleAssignments.find(
    (a) => a.userId === userId && a.isPrimary,
  );

  if (!userPrimaryRole) {
    return {
      allowed: true, // No primary role = no limit restriction
      currentLeaveCount: 0,
      maxAllowed: 999,
      spotsAvailable: 999,
    };
  }

  // 2. Find limit for this department
  const departmentLimit = departmentLimits.find(
    (l) => l.jobRoleId === userPrimaryRole.jobRoleId,
  );

  if (!departmentLimit) {
    return {
      allowed: true, // No limit configured = no restriction
      currentLeaveCount: 0,
      maxAllowed: 999,
      spotsAvailable: 999,
    };
  }

  // 3. Count approved leave requests for this date in this department
  const usersInDepartment = roleAssignments
    .filter((a) => a.jobRoleId === userPrimaryRole.jobRoleId && a.isPrimary)
    .map((a) => a.userId);

  const approvedLeaveOnDate = leaveRequests.filter(
    (r) =>
      r.date === date &&
      r.status === 'approved' &&
      usersInDepartment.includes(r.userId),
  ).length;

  // 4. Check if at or above limit
  const spotsAvailable = departmentLimit.maxLeavePerDay - approvedLeaveOnDate;
  const allowed = spotsAvailable > 0;

  return {
    allowed,
    reason: allowed
      ? undefined
      : `Department has reached maximum leave capacity for ${date}. Maximum ${departmentLimit.maxLeavePerDay} people allowed off. Please request a different date.`,
    currentLeaveCount: approvedLeaveOnDate,
    maxAllowed: departmentLimit.maxLeavePerDay,
    spotsAvailable: Math.max(0, spotsAvailable),
  };
}

/**
 * Get department coverage for a specific date
 * Shows how many people are available per department
 */
export function getDepartmentCoverageForDate(
  date: string,
  roleAssignments: StaffRoleAssignment[],
  leaveRequests: LeaveRequest[],
  departmentLimits: DepartmentLeaveLimit[],
): {
  department: string;
  jobRoleId: string;
  totalMembers: number;
  availableMembers: number;
  onLeave: number;
  maxAllowedOff: number;
  utilization: number; // percentage of max capacity used
}[] {
  const coverage = [] as any[];

  // Group staff by department
  const departmentMap = new Map<string, string[]>();
  for (const assignment of roleAssignments) {
    if (!assignment.isPrimary) continue;

    if (!departmentMap.has(assignment.jobRoleId)) {
      departmentMap.set(assignment.jobRoleId, []);
    }
    departmentMap.get(assignment.jobRoleId)!.push(assignment.userId);
  }

  // Calculate coverage per department
  for (const [jobRoleId, memberIds] of departmentMap) {
    const limit = departmentLimits.find((l) => l.jobRoleId === jobRoleId);
    const maxAllowed = limit?.maxLeavePerDay ?? memberIds.length;

    const onLeave = leaveRequests.filter(
      (r) =>
        r.date === date &&
        r.status === 'approved' &&
        memberIds.includes(r.userId),
    ).length;

    const deptName = limit?.jobRoleName ?? jobRoleId;

    coverage.push({
      department: deptName,
      jobRoleId,
      totalMembers: memberIds.length,
      availableMembers: memberIds.length - onLeave,
      onLeave,
      maxAllowedOff: maxAllowed,
      utilization: Math.round((onLeave / maxAllowed) * 100),
    });
  }

  return coverage;
}

/**
 * Check if department will be below minimum coverage
 * Useful for warning managers about coverage gaps
 */
export function checkDepartmentCoverageWarning(
  date: string,
  jobRoleId: string,
  roleAssignments: StaffRoleAssignment[],
  leaveRequests: LeaveRequest[],
  minimumCoveragePercentage: number = 50, // Keep at least 50% of staff
): { warning: boolean; reason?: string } {
  const usersInDept = roleAssignments.filter(
    (a) => a.jobRoleId === jobRoleId && a.isPrimary,
  ).map((a) => a.userId);

  const onLeave = leaveRequests.filter(
    (r) =>
      r.date === date &&
      r.status === 'approved' &&
      usersInDept.includes(r.userId),
  ).length;

  const remaining = usersInDept.length - onLeave;
  const coveragePercentage = usersInDept.length > 0 ? (remaining / usersInDept.length) * 100 : 0;

  return {
    warning: coveragePercentage < minimumCoveragePercentage,
    reason:
      coveragePercentage < minimumCoveragePercentage
        ? `Department will have only ${coveragePercentage.toFixed(0)}% coverage on ${date}`
        : undefined,
  };
}
