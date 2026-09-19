/**
 * Parses schedule calendar PDFs to extract guide assignments
 * Expected format: Calendar grid with days of week as headers and guide names in cells
 */

import type { Schedule } from '../models/schedule';

const DAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_NAME_TO_INDEX: Record<string, number> = {
  MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6,
};

interface CalendarCell {
  date: number;
  dayOfWeekIndex: number;
  guides: string[];
}

/**
 * Parses a table from pdfplumber into schedule entries
 * @param table - 2D array from pdfplumber.extract_tables()
 * @param month - Month number (1-12)
 * @param year - Year (2026, etc)
 */
export function parseScheduleTable(
  table: string[][],
  month: number,
  year: number
): Schedule[] {
  const schedules: Schedule[] = [];

  if (table.length < 2) return schedules;

  // First row should be day headers (MONDAY, TUESDAY, etc)
  const headers = table[0];
  const dayIndices = headers
    .map((h, idx) => (DAY_NAME_TO_INDEX[h.toUpperCase()] !== undefined ? idx : -1))
    .filter(idx => idx !== -1);

  if (dayIndices.length === 0) return schedules;

  // Extract calendar weeks and dates
  let currentDate = 1;
  const monthDays = getDaysInMonth(year, month);

  for (let row = 1; row < table.length; row++) {
    const cells = table[row];

    // Look for date numbers in the cells
    for (let col = 0; col < cells.length && currentDate <= monthDays; col++) {
      const cell = cells[col].trim();

      // Check if this cell contains a date number
      if (/^\d+$/.test(cell) && parseInt(cell) >= 1 && parseInt(cell) <= monthDays) {
        currentDate = parseInt(cell);
        continue;
      }

      // If we have a current date and this cell is a guide name, record it
      if (currentDate >= 1 && currentDate <= monthDays && cell && !/^\d+$/.test(cell)) {
        const dayOfWeekIndex = getDayOfWeekForDate(year, month, currentDate);
        const dayOfWeekName = DAY_NAMES[dayOfWeekIndex];

        schedules.push({
          date: formatDate(year, month, currentDate),
          dayOfWeek: dayOfWeekName,
          guide: cell.trim(),
          month,
          year,
        });
      }
    }
  }

  return schedules;
}

/**
 * Better approach: Parse the structured calendar grid
 * Expects format like: [headers], [week1_dates], [week1_guides], [week2_dates], ...
 */
export function parseScheduleTableGrid(
  table: string[][],
  month: number,
  year: number
): Schedule[] {
  const schedules: Schedule[] = [];

  if (table.length < 2) return schedules;

  // Find day header row
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(table.length, 3); i++) {
    if (table[i].some(cell => DAY_NAME_TO_INDEX[cell.trim().toUpperCase()] !== undefined)) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) return schedules;

  const headerRow = table[headerRowIdx];
  const dayColumns: Record<number, string> = {};

  // Map which columns correspond to which days of week
  for (let col = 0; col < headerRow.length; col++) {
    const header = headerRow[col].trim().toUpperCase();
    if (DAY_NAME_TO_INDEX[header] !== undefined) {
      dayColumns[col] = header;
    }
  }

  if (Object.keys(dayColumns).length === 0) return schedules;

  // Track current week's date row
  let currentWeekDates: Record<number, number> = {};

  // Process rows after header
  for (let row = headerRowIdx + 1; row < table.length; row++) {
    const cells = table[row];

    // Check if this row contains dates for the week
    let hasDateNumbers = false;
    for (const col of Object.keys(dayColumns)) {
      const colNum = parseInt(col);
      if (cells[colNum] && /^\d+$/.test(cells[colNum].trim())) {
        const dateNum = parseInt(cells[colNum].trim());
        if (dateNum >= 1 && dateNum <= 31) {
          currentWeekDates[colNum] = dateNum;
          hasDateNumbers = true;
        }
      }
    }

    // If this row contains dates, it starts a new week
    if (hasDateNumbers) {
      continue;
    }

    // Otherwise, this row contains guide names for the week's dates
    for (const col of Object.keys(dayColumns)) {
      const colNum = parseInt(col);
      const guideName = cells[colNum]?.trim();

      // Skip empty cells or cells that look like notes
      if (!guideName || /^\d+$/.test(guideName) || guideName.includes('need') || guideName.includes('HB')) {
        continue;
      }

      if (currentWeekDates[colNum]) {
        const date = currentWeekDates[colNum];
        const dayOfWeek = dayColumns[colNum];
        schedules.push({
          date: formatDate(year, month, date),
          dayOfWeek,
          guide: guideName,
          month,
          year,
        });
      }
    }
  }

  return schedules;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDayOfWeekForDate(year: number, month: number, day: number): number {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0 ? 6 : date.getDay() - 1; // Convert to 0=Monday format
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
