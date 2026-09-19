/**
 * Department Leave Limits
 *
 * Defines maximum number of staff allowed to take leave on the same day
 * for each department/field. Enforced on a first-come, first-served basis.
 *
 * Example: max_leave_per_day = 2 for "Guide" field means only 2 guides
 * can be off on the same day. Third request gets blocked.
 */

export interface DepartmentLeaveLimit {
  id: string;
  jobRoleId: string;         // Which field/department (FK to job_roles.id)
  jobRoleName?: string;      // Denormalized for convenience
  maxLeavePerDay: number;    // Max people allowed off same day (e.g., 2)
  enforcementLevel: 'HARD' | 'SOFT';  // HARD=block, SOFT=warn
  createdAt: string;
  updatedAt: string;
}

export type LeaveValidationResult = {
  allowed: boolean;
  reason?: string;
  currentLeaveCount: number;
  maxAllowed: number;
  spotsAvailable: number;
};
