/**
 * Tracks a staff member's leave balances for a specific period.
 *
 * Business rules:
 * - Staff get 6 regular days off per 4-week cycle
 * - First Sunday of every month is auto-off, consuming 1 regular day-off
 * - Staff accrue 2 paid vacation days per month
 * - Super admin can manually adjust balances
 *
 * IMPORTANT: `cycleStart` defines the 4-week window for regular days off.
 * Vacation balance is cumulative (rolls over) unless capped by admin.
 */
export interface LeaveBalance {
  id: string;
  userId: string;

  /** 4-week cycle this balance applies to (ISO date of cycle start) */
  cycleStart: string;
  cycleEnd: string;

  /** Regular days off */
  regularDaysAllowed: number; // Default: 6
  regularDaysUsed: number;
  regularDaysRemaining: number; // Computed: allowed - used

  /** Paid vacation (cumulative) */
  vacationDaysTotal: number; // Accrued total
  vacationDaysUsed: number;
  vacationDaysRemaining: number; // Computed: total - used

  /** Tracks the auto-Sunday consumption */
  autoSundayConsumed: boolean;

  updatedAt: string;
}

/**
 * Manual balance adjustment by super admin.
 * Tracked for audit trail.
 */
export interface BalanceAdjustment {
  id: string;
  userId: string;
  adjustedBy: string; // admin user ID
  field: 'regularDaysAllowed' | 'vacationDaysTotal';
  previousValue: number;
  newValue: number;
  reason: string;
  createdAt: string;
}
