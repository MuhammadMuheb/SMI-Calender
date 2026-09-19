/**
 * Department/Field Audit Utility
 *
 * Run this to generate a comprehensive report of all fields/departments
 * and their member counts. Usage in browser console:
 *
 * import { auditAllDepartments } from './utils/departmentAudit';
 * const report = auditAllDepartments(appData);
 * console.table(report);
 */

import type { StaffUser } from '../models/user';
import type { JobRole, StaffRoleAssignment } from '../models/jobRole';

export interface DepartmentAudit {
  departmentId: string;
  departmentName: string;
  totalMembers: number;
  members: {
    id: string;
    displayName: string;
    username: string;
    isPrimary: boolean; // is_primary in assignments
  }[];
  hasMembers: boolean;
  status: 'ACTIVE ✓' | 'EMPTY ⚠️';
  isHidden: boolean;
  shiftTiming: string;
}

export interface AuditSummary {
  totalDepartments: number;
  departmentsWithMembers: number;
  departmentsEmpty: number;
  totalStaffAssignments: number;
  totalUniqueStaffMembers: number;
  departments: DepartmentAudit[];
}

/**
 * Generate comprehensive audit of all departments and their members
 */
export function auditAllDepartments(
  jobRoles: JobRole[],
  users: StaffUser[],
  roleAssignments: StaffRoleAssignment[],
): AuditSummary {
  const departments: DepartmentAudit[] = jobRoles.map((role) => {
    // Get all assignments for this role
    const assignmentsForRole = roleAssignments.filter(
      (a) => a.jobRoleId === role.id,
    );

    // Get user details for each assignment
    const members = assignmentsForRole
      .map((assignment) => {
        const user = users.find((u) => u.id === assignment.userId);
        return user
          ? {
              id: user.id,
              displayName: user.displayName ?? user.username ?? 'Unknown User',
              username: user.username,
              isPrimary: assignment.isPrimary,
            }
          : null;
      })
      .filter((m) => m !== null) as DepartmentAudit['members'];

    return {
      departmentId: role.id,
      departmentName: role.name,
      totalMembers: members.length,
      members,
      hasMembers: members.length > 0,
      status: members.length === 0 ? 'EMPTY ⚠️' : 'ACTIVE ✓',
      isHidden: role.isHidden,
      shiftTiming: `${role.shiftStartTime} - ${role.shiftEndTime}`,
    };
  });

  const uniqueStaffIds = new Set(roleAssignments.map((a) => a.userId));

  return {
    totalDepartments: jobRoles.length,
    departmentsWithMembers: departments.filter((d) => d.hasMembers).length,
    departmentsEmpty: departments.filter((d) => !d.hasMembers).length,
    totalStaffAssignments: roleAssignments.length,
    totalUniqueStaffMembers: uniqueStaffIds.size,
    departments,
  };
}

/**
 * Generate a CSV export of the audit
 */
export function exportAuditToCSV(summary: AuditSummary): string {
  const lines: string[] = [];

  // Header
  lines.push('Department Audit Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push(`Total Departments,${summary.totalDepartments}`);
  lines.push(`Departments with Members,${summary.departmentsWithMembers}`);
  lines.push(`Empty Departments,${summary.departmentsEmpty}`);
  lines.push(`Total Staff Assignments,${summary.totalStaffAssignments}`);
  lines.push(`Unique Staff Members,${summary.totalUniqueStaffMembers}`);
  lines.push('');

  // Department details
  lines.push('DEPARTMENTS');
  lines.push(
    'Department,Members,Status,Hidden,Shift Timing,Member List',
  );
  for (const dept of summary.departments) {
    const memberList = dept.members
      .map((m) => `${m.displayName}${m.isPrimary ? ' (Primary)' : ''}`)
      .join('; ');
    lines.push(
      `"${dept.departmentName}",${dept.totalMembers},"${dept.status}",${dept.isHidden},"${dept.shiftTiming}","${memberList}"`,
    );
  }

  return lines.join('\n');
}

/**
 * Print audit to console in formatted table
 */
export function printAuditToConsole(summary: AuditSummary): void {
  console.log('═══════════════════════════════════════════════════════');
  console.log('DEPARTMENT AUDIT REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('SUMMARY:');
  console.log(`  Total Departments:        ${summary.totalDepartments}`);
  console.log(
    `  Departments with Members: ${summary.departmentsWithMembers}`,
  );
  console.log(`  Empty Departments:        ${summary.departmentsEmpty} ⚠️`);
  console.log(`  Total Assignments:        ${summary.totalStaffAssignments}`);
  console.log(`  Unique Staff Members:     ${summary.totalUniqueStaffMembers}`);
  console.log('');
  console.log('DEPARTMENTS:');
  console.log('');

  for (const dept of summary.departments) {
    console.log(`📌 ${dept.departmentName} ${dept.isHidden ? '(HIDDEN)' : ''}`);
    console.log(`   ID: ${dept.departmentId}`);
    console.log(`   Status: ${dept.status}`);
    console.log(`   Total Members: ${dept.totalMembers}`);
    console.log(`   Shift: ${dept.shiftTiming}`);

    if (dept.members.length === 0) {
      console.log(`   ⚠️ NO MEMBERS ASSIGNED`);
    } else {
      console.log(`   Members:`);
      for (const member of dept.members) {
        console.log(
          `     • ${member.displayName} (${member.username})${member.isPrimary ? ' [PRIMARY]' : ''}`,
        );
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════');
}

/**
 * Find all empty departments
 */
export function findEmptyDepartments(summary: AuditSummary): DepartmentAudit[] {
  return summary.departments.filter((d) => !d.hasMembers);
}

/**
 * Find departments with only one member
 */
export function findUnderstaffedDepartments(
  summary: AuditSummary,
  threshold: number = 2,
): DepartmentAudit[] {
  return summary.departments.filter(
    (d) => d.hasMembers && d.totalMembers < threshold,
  );
}

/**
 * Get all members who are assigned to multiple departments
 */
export function findCrossFunctionalStaff(
  jobRoles: JobRole[],
  users: StaffUser[],
  roleAssignments: StaffRoleAssignment[],
): {
  user: StaffUser;
  departments: string[];
  count: number;
}[] {
  const staffWithMultipleRoles: Record<
    string,
    { user: StaffUser; departments: Set<string> }
  > = {};

  for (const assignment of roleAssignments) {
    const user = users.find((u) => u.id === assignment.userId);
    if (!user) continue;

    const dept = jobRoles.find((r) => r.id === assignment.jobRoleId);
    if (!dept) continue;

    if (!staffWithMultipleRoles[user.id]) {
      staffWithMultipleRoles[user.id] = { user, departments: new Set() };
    }
    staffWithMultipleRoles[user.id].departments.add(dept.name);
  }

  return Object.values(staffWithMultipleRoles)
    .filter((s) => s.departments.size > 1)
    .map((s) => ({
      user: s.user,
      departments: Array.from(s.departments),
      count: s.departments.size,
    }));
}
