import type { DaySummary } from '../models/calendar';
import type { LeaveRequest } from '../models/leave';
import type { Holiday, SpecialDay } from '../models/holiday';
import type { StaffingRule } from '../models/staffing';
import type { StaffRoleAssignment } from '../models/jobRole';
import type { Schedule } from '../models/schedule';
import { checkStaffingForDate, wouldCauseShortage } from './staffingService';

/**
 * STATUS: SERVICE PLACEHOLDER
 * Computes day summaries for the calendar grid.
 * No database — works from in-memory arrays.
 * Now uses per-role staffing check from staffingService.
 */

/**
 * Build a DaySummary for each day in a month.
 * Uses per-role staffing checks (not simplified total).
 */
export function buildMonthSummaries(
  year: number,
  month: number,
  totalStaff: number,
  requests: LeaveRequest[],
  holidays: Holiday[],
  specialDays: SpecialDay[],
  staffingRules: StaffingRule[],
  roleAssignments: StaffRoleAssignment[],
  roleNames: Record<string, string>,
  schedules: Schedule[] = [],
): DaySummary[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const summaries: DaySummary[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const dayRequests = requests.filter((r) => r.date === dateStr);
    const approvedLeaves = dayRequests.filter((r) => r.status === 'approved').length;
    const pendingRequests = dayRequests.filter((r) => r.status === 'pending').length;
    const approvedOnDate = dayRequests.filter((r) => r.status === 'approved');

    const isHoliday = holidays.some((h) => h.date === dateStr);
    const isSpecialDay = specialDays.some((s) => s.date === dateStr);

    // Get scheduled guides for this date
    const daySchedules = schedules.filter((s) => s.date === dateStr);
    const scheduledGuides = [...new Set(daySchedules.map((s) => s.guide))].sort();

    const onDuty = totalStaff - approvedLeaves;

    // Per-role staffing check
    const staffingStatuses = checkStaffingForDate(
      dateStr,
      staffingRules,
      roleAssignments,
      approvedOnDate,
      roleNames,
    );
    const { hasShortage } = wouldCauseShortage(staffingStatuses);

    summaries.push({
      date: dateStr,
      totalStaff,
      onDuty,
      approvedLeaves,
      pendingRequests,
      isHoliday,
      isSpecialDay,
      hasStaffingWarning: hasShortage,
      scheduledGuides,
      scheduledGuidesCount: scheduledGuides.length,
    });
  }

  return summaries;
}
