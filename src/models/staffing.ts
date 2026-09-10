/**
 * Defines minimum staffing requirements per job role per day of week.
 *
 * Example: "Need at least 2 Guides on Mondays"
 *
 * Hidden roles are included in staffing calculations
 * even though they're not visible to managers/staff.
 */
export interface StaffingRule {
  id: string;
  jobRoleId: string;

  /**
   * Day of week: 0=Monday, 6=Sunday
   * null means "applies to all days"
   */
  dayOfWeek: number | null;

  /** Minimum staff needed with this role */
  minimumRequired: number;

  /** What happens when approval would break this minimum */
  enforcement: StaffingEnforcement;

  createdAt: string;
  updatedAt: string;
}

/**
 * How strictly the minimum is enforced when approving leave.
 * - 'hard_block': cannot approve if it breaks minimum
 * - 'warning_only': show warning but allow approval
 */
export type StaffingEnforcement = 'hard_block' | 'warning_only';

/**
 * Computed staffing status for a specific date + role.
 * Used by the approval flow to show impact.
 */
export interface StaffingStatus {
  date: string;
  jobRoleId: string;
  jobRoleName: string;
  required: number;
  scheduled: number;
  surplus: number; // scheduled - required (negative = shortage)
  enforcement: StaffingEnforcement;
}
