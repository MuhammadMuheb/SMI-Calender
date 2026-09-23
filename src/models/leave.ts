import type { UserRef } from '@/models/user';

/**
 * Types of leave in the system.
 *
 * REGULAR_DAY_OFF — from the 6-per-4-weeks allowance
 * PAID_VACATION — from accrued vacation balance (2/month)
 * AUTO_ASSIGNED — system-assigned unused day-off (Phase 8 engine)
 * AUTO_SUNDAY — first Sunday of month, auto-assigned, consumes 1 regular day-off
 * SPECIAL_DAY — admin-declared special day (may or may not consume balance)
 */
export type LeaveType =
  | 'regular_day_off'
  | 'paid_vacation'
  | 'auto_assigned'
  | 'auto_sunday'
  | 'special_day'
  | 'sick_day';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  userId: string;
  userRef: UserRef;

  /** The specific date being requested off */
  date: string; // ISO date YYYY-MM-DD

  leaveType: LeaveType;
  status: LeaveStatus;

  /** Optional note from the requesting staff member */
  staffNote: string;

  /** Optional note from the approver (manager/admin) */
  approverNote: string;

  /** Who approved/rejected this request (null if still pending) */
  decidedBy: UserRef | null;
  decidedAt: string | null;

  /** Was this request overridden by super admin after initial decision? */
  isOverridden: boolean;
  overriddenBy: UserRef | null;
  overriddenAt: string | null;

  attachmentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Human-readable labels for leave types */
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  regular_day_off: 'Day off',
  paid_vacation: 'Paid vacation',
  auto_assigned: 'Auto-assigned',
  auto_sunday: 'Monthly Sunday',
  special_day: 'Special day',
  sick_day: 'Sick day',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/** Badge color mapping for UI */
export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'gray',
};
