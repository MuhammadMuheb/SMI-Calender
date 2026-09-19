import type { LeaveRequest } from '../models/leave';
import type { StaffUser } from '../models/user';
import { formatDateLocal } from '../utils/dateUtils';
import { CYCLE_LENGTH_DAYS, REGULAR_DAYS_OFF_PER_CYCLE } from '../models/validation';

const EPOCH = new Date('2026-01-12T00:00:00');

export function getCycleInfo(dateStr?: string) {
  const target = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const daysSinceEpoch = Math.floor((target.getTime() - EPOCH.getTime()) / 86400000);
  const cycleIndex = Math.floor(daysSinceEpoch / CYCLE_LENGTH_DAYS);
  const dayInCycle = daysSinceEpoch % CYCLE_LENGTH_DAYS; // 0-27

  const cycleStart = new Date(EPOCH);
  cycleStart.setDate(cycleStart.getDate() + cycleIndex * CYCLE_LENGTH_DAYS);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + CYCLE_LENGTH_DAYS - 1);

  const nextStart = new Date(cycleStart);
  nextStart.setDate(nextStart.getDate() + CYCLE_LENGTH_DAYS);
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextEnd.getDate() + CYCLE_LENGTH_DAYS - 1);

  const week = Math.floor(dayInCycle / 7) + 1; // 1-4

  return {
    cycleIndex,
    dayInCycle,
    week,
    currentStart: formatDateLocal(cycleStart),
    currentEnd: formatDateLocal(cycleEnd),
    nextStart: formatDateLocal(nextStart),
    nextEnd: formatDateLocal(nextEnd),
  };
}

/** Check who hasn't requested all 6 days in a cycle */
export function getUnfilledUsers(
  users: StaffUser[],
  requests: LeaveRequest[],
  cycleStart: string,
  cycleEnd: string,
): { userId: string; name: string; used: number; remaining: number }[] {
  const result: { userId: string; name: string; used: number; remaining: number }[] = [];
  for (const u of users.filter(u => u.isActive)) {
    const used = requests.filter(
      r => r.userId === u.id && r.date >= cycleStart && r.date <= cycleEnd
        && r.status === 'approved' && (r.leaveType === 'regular_day_off' || r.leaveType === 'auto_assigned')
    ).length;
    const pending = requests.filter(
      r => r.userId === u.id && r.date >= cycleStart && r.date <= cycleEnd && r.status === 'pending'
    ).length;
    const total = used + pending;
    if (total < REGULAR_DAYS_OFF_PER_CYCLE) {
      result.push({ userId: u.id, name: u.displayName ?? u.username ?? 'Unknown User', used: total, remaining: REGULAR_DAYS_OFF_PER_CYCLE - total });
    }
  }
  return result;
}

/** Actions to take based on current cycle state */
export interface CycleActions {
  sendCycleOpenNotification: boolean;
  sendWeek3Warnings: boolean;
  runAutoAssignForPrevCycle: boolean;
  unfilledUsers: { userId: string; name: string; used: number; remaining: number }[];
  nextCycleLabel: string;
  currentCycleLabel: string;
}

export function checkCycleActions(
  users: StaffUser[],
  requests: LeaveRequest[],
  lastCheckedCycle: number | null,
  lastWarningCycle: number | null,
  lastAutoAssignCycle: number | null,
): CycleActions {
  const info = getCycleInfo();
  const currentLabel = `${new Date(info.currentStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(info.currentEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const nextLabel = `${new Date(info.nextStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(info.nextEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // 1. Send "next cycle open" notification when a new cycle starts
  const sendCycleOpen = lastCheckedCycle === null || lastCheckedCycle < info.cycleIndex;

  // 2. Week 3 warning for unfilled users
  const sendWarnings = info.week >= 3 && (lastWarningCycle === null || lastWarningCycle < info.cycleIndex);
  const unfilled = getUnfilledUsers(users, requests, info.currentStart, info.currentEnd);

  // 3. Auto-assign for previous cycle at cycle start (day 0-1)
  const prevCycleIndex = info.cycleIndex - 1;
  const runAutoAssign = info.dayInCycle <= 1 && (lastAutoAssignCycle === null || lastAutoAssignCycle < prevCycleIndex);

  return {
    sendCycleOpenNotification: sendCycleOpen,
    sendWeek3Warnings: sendWarnings && unfilled.length > 0,
    runAutoAssignForPrevCycle: runAutoAssign,
    unfilledUsers: unfilled,
    nextCycleLabel: nextLabel,
    currentCycleLabel: currentLabel,
  };
}
