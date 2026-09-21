import { useMemo } from 'react';
import type { DaySummary } from '../models/calendar';
import type { LeaveRequest } from '../models/leave';
import { buildMonthSummaries } from '../services/calendarService';
import { useAppData } from '../context/AppDataContext';


/**
 * STATUS: USES AppDataContext (REACTIVE)
 * Produces a map of date → DaySummary for the given month.
 * Reads from AppDataContext so admin changes to roles, rules,
 * holidays, and special days are reflected immediately.
 */

export function useCalendarData(
  year: number,
  month: number,
  leaveRequests: LeaveRequest[] = [],
) {
  const {
    users, jobRoles, roleAssignments,
    staffingRules, holidays, specialDays, schedules,
  } = useAppData();

  const roleNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of jobRoles) {
      map[r.id] = r.name;
    }
    return map;
  }, [jobRoles]);

  const totalStaff = useMemo(
    () => users.filter((u) => u.isActive).length,
    [users],
  );

  const activeUserDisplayNames = useMemo(
    () => users.filter((u) => u.isActive).map((u) => u.displayName),
    [users],
  );

  const summaries = useMemo(
    () =>
      buildMonthSummaries(
        year,
        month,
        totalStaff,
        leaveRequests,
        holidays,
        specialDays,
        staffingRules,
        roleAssignments,
        roleNames,
        schedules,
        activeUserDisplayNames, // CRITICAL: Pass active user names for filtering
      ),
    [year, month, leaveRequests, totalStaff, holidays, specialDays, staffingRules, roleAssignments, roleNames, schedules, activeUserDisplayNames],
  );

  const summaryMap = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const s of summaries) {
      map.set(s.date, s);
    }
    return map;
  }, [summaries]);

  return { summaries, summaryMap, totalStaff };
}
