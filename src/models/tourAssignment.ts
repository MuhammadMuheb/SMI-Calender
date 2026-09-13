/**
 * A staff/guide's scheduled tour duty on a given date.
 * Populated by the historical-schedule importer (scripts/import-tour-schedule.mjs)
 * and displayed on the calendar so guides don't need to be entered by hand each month.
 */
export interface TourAssignment {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  source: string; // 'manual' or 'import:<label>'
  note: string;
  createdAt: string;
}
