/**
 * SMI Calendar — Cycle System
 *
 * Rules:
 * - Cycles are month-based, starting from system epoch (April 2026)
 * - Each cycle: starts 1st of month (or day after prev cycle ends), ends first Sunday >= month end
 * - 4-week cycle = 6 days off, 5-week cycle = 7 days off
 * - Pattern 1-2-1-2 (4wk) or 1-2-1-2-1 (5wk) — staff distributes freely
 * - First Sunday of every calendar month = auto-off, deducted from quota
 * - Staff/managers pick days for NEXT cycle while in current cycle
 * - Once in LAST WEEK of current cycle → picking locked (super admin only)
 * - Last week of any cycle: only super admin can assign
 * - Sick days & vacation: any date today → Dec 31 (no cycle restriction)
 */

// ── CONFIG ──────────────────────────────────────────────
// First cycle starts April 1, 2026
const EPOCH_YEAR = 2026;
const EPOCH_MONTH = 3; // 0-indexed (3 = April)

// ── TYPES ───────────────────────────────────────────────
export interface Cycle {
  index: number;
  month: number;      // 0-indexed JS month
  year: number;
  start: string;      // YYYY-MM-DD
  end: string;        // YYYY-MM-DD
  weeks: number;
  quota: number;      // 6 or 7
  lastWeekStart: string; // Monday of the last week
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

// ── GENERATE ALL CYCLES ─────────────────────────────────
// Generates cycles from epoch forward. Call once, cache result.
let _cycleCache: Cycle[] | null = null;

export function generateCycles(count: number = 24): Cycle[] {
  if (_cycleCache && _cycleCache.length >= count) return _cycleCache;

  const cycles: Cycle[] = [];
  let nextStart: Date | null = null;

  for (let i = 0; i < count + 4; i++) {
    const m = (EPOCH_MONTH + i) % 12;
    const y = EPOCH_YEAR + Math.floor((EPOCH_MONTH + i) / 12);

    const cycleStart = nextStart || new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0); // last day of this month

    // Skip if cycle start already past this month
    if (cycleStart > monthEnd) {
      // This month is entirely consumed by previous cycle, skip
      continue;
    }

    // Cycle end = first Sunday >= monthEnd
    const cycleEnd = new Date(monthEnd);
    const dow = cycleEnd.getDay();
    if (dow !== 0) cycleEnd.setDate(cycleEnd.getDate() + (7 - dow));

    // Week count
    const totalDays = Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86400000) + 1;
    const weeks = Math.ceil(totalDays / 7);

    // Quota: 4 weeks = 6, 5+ weeks = 7
    const quota = weeks >= 5 ? 7 : 6;

    // Last week = Monday through Sunday of final week
    const lastWeekStart = new Date(cycleEnd);
    lastWeekStart.setDate(lastWeekStart.getDate() - 6);

    // First Sunday of the calendar month (auto-off)
    const firstSunday = getFirstSundayOfMonth(y, m);

    cycles.push({
      index: cycles.length,
      month: m,
      year: y,
      start: fmt(cycleStart),
      end: fmt(cycleEnd),
      weeks,
      quota,
      lastWeekStart: fmt(lastWeekStart),
      firstSundayOfMonth: firstSunday,
    });

    // Next cycle starts day after this one ends
    nextStart = new Date(cycleEnd);
    nextStart.setDate(nextStart.getDate() + 1);

    if (cycles.length >= count) break;
  }

  _cycleCache = cycles;
  return cycles;
}

// ── LOOKUPS ─────────────────────────────────────────────

/** Find which cycle a date falls in */
export function getCycleForDate(dateStr: string): Cycle | null {
  const cycles = generateCycles();
  for (const c of cycles) {
    if (dateStr >= c.start && dateStr <= c.end) return c;
  }
  return null;
}

/** Current cycle (today) */
export function getCurrentCycle(): Cycle | null {
  return getCycleForDate(todayStr());
}

/** Next cycle after the current one */
export function getNextCycle(): Cycle | null {
  const current = getCurrentCycle();
  if (!current) return null;
  const cycles = generateCycles();
  return cycles.find((c) => c.index === current.index + 1) || null;
}

/** Are we in the last week of the current cycle? */
export function isInLastWeek(): boolean {
  const current = getCurrentCycle();
  if (!current) return false;
  return todayStr() >= current.lastWeekStart;
}

/**
 * Which week of the cycle a date falls in (1-indexed, clamped to the cycle's length).
 * Week 1 = the 7 days starting at cycle.start. Defaults to today.
 */
export function getWeekNumberInCycle(cycle: Cycle, dateStr: string = todayStr()): number {
  const start = new Date(cycle.start + 'T00:00:00');
  const current = new Date(dateStr + 'T00:00:00');
  const daysElapsed = Math.round((current.getTime() - start.getTime()) / 86400000);
  const week = Math.floor(daysElapsed / 7) + 1;
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
 * Returns the date range a user can pick for regular day off requests.
 * - super_admin: full next cycle (including last week)
 * - staff/manager: next cycle excluding last week, BUT locked if in last week of current cycle
 */
export function getPickableDateRange(userRole: string): PickableRange | null {
  const next = getNextCycle();
  if (!next) return null;

  // Super admin: full next cycle, always available
  if (userRole === 'super_admin') {
    return { min: next.start, max: next.end, cycle: next, locked: false };
  }

  // Staff/manager: check if in last week of current cycle
  if (isInLastWeek()) {
    return {
      min: next.start,
      max: next.end,
      cycle: next,
      locked: true,
      lockedReason: 'Picking is locked — you are in the last week of the current cycle. Contact your super admin.',
    };
  }

  // Can pick for next cycle, excluding last week
  
  
  

  return { min: next.start, max: next.end, cycle: next, locked: false };
}

/**
 * Get remaining quota for a user in a given cycle, considering already-approved requests.
 * Pass in approved request dates for that user within the cycle range.
 */
export function getRemainingQuota(cycle: Cycle, approvedDatesInCycle: string[]): number {
  // Check if first Sunday of month falls within this cycle and is auto-assigned
  const autoSundayInCycle = cycle.firstSundayOfMonth >= cycle.start && cycle.firstSundayOfMonth <= cycle.end;
  const autoSundayCount = autoSundayInCycle ? 1 : 0;

  const usedDays = approvedDatesInCycle.length;
  // Quota includes the auto-Sunday, so remaining = quota - autoSunday - userPicked
  return Math.max(cycle.quota - autoSundayCount - usedDays, 0);
}

/** Month label for a cycle */
export function getCycleLabel(cycle: Cycle): string {
  const monthName = new Date(cycle.year, cycle.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const startLabel = new Date(cycle.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = new Date(cycle.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${monthName} cycle (${startLabel} – ${endLabel})`;
}
