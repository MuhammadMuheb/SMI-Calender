/**
 * Business rule constants and validation helpers.
 * These are the authoritative source for all magic numbers
 * used in balance calculations, scheduling, and validation.
 */

/** Regular days off allowed per 4-week cycle */
export const REGULAR_DAYS_OFF_PER_CYCLE = 6;

/** Length of one scheduling cycle in days */
export const CYCLE_LENGTH_DAYS = 28;

/** Paid vacation days accrued per calendar month */
export const VACATION_ACCRUAL_PER_MONTH = 2;

/** Default daily reminder time (HH:MM) */
export const DEFAULT_REMINDER_TIME = '14:00';

/** PIN must be at least this many digits */
export const MIN_PIN_LENGTH = 4;

/** PIN cannot exceed this many digits */
export const MAX_PIN_LENGTH = 6;

// ─── Validation helpers ──────────────────────────────────────────

/**
 * Check if a date string is a valid ISO date (YYYY-MM-DD).
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();

  // Try YYYY-MM-DD (standard HTML date input format)
  let parts = trimmed.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    return (
      !isNaN(date.getTime()) &&
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
    );
  }

  // Fallback: try DD/MM/YYYY (some locales)
  parts = trimmed.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    return (
      !isNaN(date.getTime()) &&
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
    );
  }

  return false;
}

/**
 * Normalize any date string to YYYY-MM-DD format.
 * Handles YYYY-MM-DD and DD/MM/YYYY inputs.
 */
export function normalizeDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  // Already YYYY-MM-DD
  const dashParts = trimmed.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    return trimmed;
  }

  // DD/MM/YYYY
  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    const [d, m, y] = slashParts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return trimmed;
}

/**
 * Check if a date falls on the first Sunday of its month.
 */
export function isFirstSundayOfMonth(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 && d.getDate() <= 7;
}

/**
 * Get the first Sunday of a given month.
 */
export function getFirstSundayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Check if a leave request date is in the future.
 */
export function isFutureDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d > today;
}

/**
 * Validate a PIN string.
 */
export function isValidPin(pin: string): boolean {
  return /^\d+$/.test(pin) && pin.length >= MIN_PIN_LENGTH && pin.length <= MAX_PIN_LENGTH;
}

/**
 * Calculate how many vacation days a user has accrued by a given month.
 * startMonth is the month they started (0-indexed).
 * currentMonth is the current month (0-indexed).
 * Both are within the same or consecutive years.
 */
export function calculateVacationAccrual(
  monthsEmployed: number,
): number {
  return monthsEmployed * VACATION_ACCRUAL_PER_MONTH;
}

/**
 * Compute 4-week cycle boundaries from a start date.
 */
export function getCycleBoundaries(
  cycleStartDate: string,
): { start: string; end: string } {
  const start = new Date(cycleStartDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + CYCLE_LENGTH_DAYS - 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    start: fmt(start),
    end: fmt(end),
  };
}
