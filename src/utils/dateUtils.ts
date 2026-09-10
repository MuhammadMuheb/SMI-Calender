/**
 * Date utilities for calendar rendering.
 * All functions use local dates (YYYY-MM-DD strings) to avoid timezone issues.
 * Month is 0-indexed (0=January) to match JavaScript Date convention.
 */

/** Days of week starting Monday */
export const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/**
 * Get the number of days in a month.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of week for the 1st of a month.
 * Returns 0=Monday through 6=Sunday.
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/**
 * Format a date as YYYY-MM-DD string (no timezone conversion).
 */
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse a YYYY-MM-DD string into parts.
 */
export function parseDateStr(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function todayStr(): string {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Format a Date object as YYYY-MM-DD using local timezone.
 * Safe alternative to date.toISOString().split('T')[0] which uses UTC.
 */
export function formatDateLocal(d: Date): string {
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Check if a date string is a weekend (Saturday=5 or Sunday=6, Mon-indexed).
 */
export function isWeekend(dateStr: string): boolean {
  const { year, month, day } = parseDateStr(dateStr);
  const dow = (new Date(year, month, day).getDay() + 6) % 7;
  return dow >= 5;
}

/**
 * Check if a date is a Sunday (6 in Mon-indexed).
 */
export function isSunday(dateStr: string): boolean {
  const { year, month, day } = parseDateStr(dateStr);
  return new Date(year, month, day).getDay() === 0;
}

/**
 * Format a month label like "April 2026".
 */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Navigate to previous month. Returns { year, month }.
 */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 0) return { year: year - 1, month: 11 };
  return { year, month: month - 1 };
}

/**
 * Navigate to next month. Returns { year, month }.
 */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 11) return { year: year + 1, month: 0 };
  return { year, month: month + 1 };
}

/**
 * Build the full grid of tiles for a month view.
 * Always shows complete weeks (Monday–Sunday).
 * Includes trailing days from the previous month and next month.
 *
 * This ensures:
 * - If month starts on Wednesday, Monday and Tuesday of that week are shown (from prev month)
 * - If month ends on Thursday, Friday–Sunday of that week are shown (from next month)
 */
export interface CalendarGridTile {
  /** The date string YYYY-MM-DD */
  dateStr: string;
  /** Day of month number */
  day: number;
  /** Whether this day belongs to the displayed month */
  isCurrentMonth: boolean;
  /** Whether this is today */
  isToday: boolean;
  /** Whether this is Saturday or Sunday */
  isWeekend: boolean;
}

export function buildMonthGrid(year: number, month: number): CalendarGridTile[] {
  const today = todayStr();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);

  const tiles: CalendarGridTile[] = [];

  // Leading days from previous month
  if (firstDow > 0) {
    const prev = prevMonth(year, month);
    const prevDays = getDaysInMonth(prev.year, prev.month);
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = prevDays - i;
      const ds = toDateStr(prev.year, prev.month, d);
      tiles.push({
        dateStr: ds,
        day: d,
        isCurrentMonth: false,
        isToday: ds === today,
        isWeekend: isWeekend(ds),
      });
    }
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(year, month, d);
    tiles.push({
      dateStr: ds,
      day: d,
      isCurrentMonth: true,
      isToday: ds === today,
      isWeekend: isWeekend(ds),
    });
  }

  // Trailing days to complete the last week
  const remaining = tiles.length % 7;
  if (remaining > 0) {
    const nxt = nextMonth(year, month);
    for (let d = 1; d <= 7 - remaining; d++) {
      const ds = toDateStr(nxt.year, nxt.month, d);
      tiles.push({
        dateStr: ds,
        day: d,
        isCurrentMonth: false,
        isToday: ds === today,
        isWeekend: isWeekend(ds),
      });
    }
  }

  return tiles;
}
