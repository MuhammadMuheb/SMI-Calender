/**
 * SMI Calendar — Day-off cycles
 *
 * Rules:
 * - A cycle is one calendar month: the 1st through the last day of the month.
 * - Each month has the standard regular day-off allowance (REGULAR_DAYS_OFF_PER_CYCLE,
 *   or a per-person override set by an administrator).
 * - Staff can request days off for any remaining day of the current month and
 *   for any day of the next month, so they can plan ahead near month end.
 * - Sick days & vacation are not tied to cycles (today → Dec 31).
 */

import { REGULAR_DAYS_OFF_PER_CYCLE } from '@/models/validation';

// ── TYPES ───────────────────────────────────────────────
export interface Cycle {
  index: number;
  month: number;      // 0-indexed JS month
  year: number;
  start: string;      // YYYY-MM-DD, 1st of the month
  end: string;        // YYYY-MM-DD, last day of the month
  weeks: number;      // calendar weeks the month spans (for "Week X of Y")
  quota: number;      // default regular day-off allowance for the month
  lastWeekStart: string;
  firstSundayOfMonth: string;
}

// ── HELPERS ─────────────────────────────────────────────
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr(): string { return fmt(new Date()); }

function getFirstSundayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return fmt(d);
}

/** Months since Jan 2000, used as a stable cycle index. */
function monthIndex(year: number, month: number): number {
  return (year - 2000) * 12 + month;
}

/** The cycle (calendar month) for a given year and 0-indexed month. */
export function getCycleForMonth(year: number, month: number): Cycle {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const lastWeekStart = new Date(last);
  lastWeekStart.setDate(last.getDate() - 6);
  return {
    index: monthIndex(first.getFullYear(), first.getMonth()),
    month: first.getMonth(),
    year: first.getFullYear(),
    start: fmt(first),
    end: fmt(last),
    weeks: Math.ceil(last.getDate() / 7),
    quota: REGULAR_DAYS_OFF_PER_CYCLE,
    lastWeekStart: fmt(lastWeekStart),
    firstSundayOfMonth: getFirstSundayOfMonth(first.getFullYear(), first.getMonth()),
  };
}

// ── LOOKUPS ─────────────────────────────────────────────

/** The cycle (calendar month) a YYYY-MM-DD date falls in. */
export function getCycleForDate(dateStr: string): Cycle | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateStr);
  if (!m) return null;
  return getCycleForMonth(Number(m[1]), Number(m[2]) - 1);
}

/** Current cycle (this calendar month). */
export function getCurrentCycle(): Cycle {
  const now = new Date();
  return getCycleForMonth(now.getFullYear(), now.getMonth());
}

/** Next cycle (next calendar month). */
export function getNextCycle(): Cycle {
  const now = new Date();
  return getCycleForMonth(now.getFullYear(), now.getMonth() + 1);
}

/** Are we in the last seven days of the current month? */
export function isInLastWeek(): boolean {
  return todayStr() >= getCurrentCycle().lastWeekStart;
}

/**
 * Which week of the month a date falls in (1-indexed; days 1–7 are week 1).
 * Defaults to today.
 */
export function getWeekNumberInCycle(cycle: Cycle, dateStr: string = todayStr()): number {
  const day = Number(dateStr.slice(8, 10));
  const week = Math.floor((day - 1) / 7) + 1;
  return Math.min(Math.max(week, 1), cycle.weeks);
}

// ── DATE RANGE FOR REQUEST FORM ─────────────────────────

interface PickableRange {
  min: string;
  max: string;
  cycle: Cycle;
  locked: boolean;
  lockedReason?: string;
}

/**
 * Dates a person can pick for a regular day off: from today through the end
 * of next month, so the whole of the current month and the next one can be planned.
 */
export function getPickableDateRange(): PickableRange {
  const current = getCurrentCycle();
  return { min: todayStr(), max: getNextCycle().end, cycle: current, locked: false };
}

/** Remaining allowance given a month's allowance and the days already counted against it. */
export function getRemainingQuota(allowance: number, usedDays: number): number {
  return Math.max(allowance - usedDays, 0);
}

/** "September 2026" */
export function getCycleLabel(cycle: Cycle): string {
  return new Date(cycle.year, cycle.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
