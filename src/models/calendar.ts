import type { LeaveType, LeaveStatus } from '@/models/leave';

/**
 * A calendar entry represents a single day's status for one staff member.
 * This is the "rendered" view used by the calendar UI — it combines
 * leave requests, auto-assignments, holidays, and special days
 * into a flat structure the frontend can display.
 *
 * STATUS: This is a computed/derived model, not directly stored.
 * Built by CalendarService from leaves, holidays, and staffing data.
 */
export interface CalendarEntry {
  date: string; // YYYY-MM-DD
  userId: string;
  displayName: string;

  /** What type of entry this is */
  entryType: LeaveType | 'working' | 'holiday';

  /** If from a leave request, its status */
  leaveStatus?: LeaveStatus;
  leaveRequestId?: string;

  /** Whether this was auto-assigned by the engine */
  isAutoAssigned: boolean;

  /** Job role(s) the user is covering this day (if working) */
  jobRoleIds: string[];
}

/**
 * Daily summary for the calendar grid — one per date.
 * Shows aggregate counts used by the tile component.
 */
export interface DaySummary {
  date: string;
  totalStaff: number;
  onDuty: number;
  approvedLeaves: number;
  pendingRequests: number;
  isHoliday: boolean;
  isSpecialDay: boolean;
  hasStaffingWarning: boolean;
  scheduledGuides: string[];
  scheduledGuidesCount: number;
}
