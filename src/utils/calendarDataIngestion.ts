declare global { interface Window { ingestAllCalendarData?: typeof ingestAllCalendarData; } }
/**
 * CALENDAR DATA INGESTION
 *
 * Precise data import from August & September calendar PDFs.
 * NO MOCK DATA - Only data explicitly shown in the PDFs.
 * This script is prepared locally for testing before any staging push.
 */

import {
  collection, setDoc, doc, getFirestore,
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════
// DATA EXTRACTED FROM PDFs - TO BE FILLED IN AFTER PDF REVIEW
// ═══════════════════════════════════════════════════════════════

/**
 * Exact users from the calendar PDFs (14 unique staff members)
 * Format: { username, displayName, pin, role }
 * ONLY includes users explicitly shown in August & September calendars
 *
 * Note: Raza (August) and Reza (September) appear to be the same person
 * Using "reza" as canonical username
 */
export const CALENDAR_USERS = [
  { username: 'desiree', displayName: 'Desiree', role: 'staff' },
  { username: 'nabeel', displayName: 'Nabeel', role: 'staff' },
  { username: 'umer', displayName: 'Umer', role: 'staff' },
  { username: 'michael', displayName: 'Michael', role: 'staff' },
  { username: 'tiziano', displayName: 'Tiziano', role: 'staff' },
  { username: 'reza', displayName: 'Reza', role: 'staff' }, // Raza/Reza - same person
  { username: 'gunzan', displayName: 'Gunzan', role: 'staff' },
  { username: 'zack', displayName: 'Zack', role: 'staff' },
  { username: 'rihab', displayName: 'Rihab', role: 'staff' },
  { username: 'jo', displayName: 'JO', role: 'staff' },
  { username: 'sherry', displayName: 'sherry', role: 'staff' },
  { username: 'kristina', displayName: 'Kristina', role: 'staff' },
  { username: 'hb', displayName: 'HB', role: 'staff' },
];

/**
 * Default job roles (not explicitly shown in calendars, but needed for system)
 * Using generic "Guide" role since no roles are specified in PDFs
 * Format: { id, name, color, shiftStartTime, shiftEndTime }
 */
export const CALENDAR_JOB_ROLES = [
  { id: 'role_guide', name: 'Guide', color: '#3B82F6', shiftStartTime: '08:00', shiftEndTime: '17:00' },
];

/**
 * Exact schedules from August 2026 calendar
 * Format: { date (YYYY-MM-DD), staffName, role, dayOfWeek }
 * ONLY includes entries explicitly shown in PDF - NO MOCK DATA
 */
export const AUGUST_SCHEDULES = [
  { date: '2026-08-01', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-02', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-02', staffName: 'Nabeel', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-02', staffName: 'Umer', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-02', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-03', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-03', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-04', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-05', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-05', staffName: 'Umer', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-05', staffName: 'JO', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-06', staffName: 'Reza', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-07', staffName: 'Umer', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-07', staffName: 'Zack', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-07', staffName: 'JO', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-08', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-09', staffName: 'Reza', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-09', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-09', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-09', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-09', staffName: 'JO', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-09', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-09', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-12', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-13', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-14', staffName: 'Umer', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-15', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-15', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-16', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-16', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-16', staffName: 'JO', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-16', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-16', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-16', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-17', staffName: 'Michael', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-17', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-17', staffName: 'JO', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-17', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-18', staffName: 'Michael', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-18', staffName: 'Zack', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-18', staffName: 'JO', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-18', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-19', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-19', staffName: 'Umer', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-19', staffName: 'Michael', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-19', staffName: 'JO', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-19', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-20', staffName: 'Michael', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-20', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-20', staffName: 'JO', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-20', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-21', staffName: 'Michael', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-21', staffName: 'JO', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-21', staffName: 'sherry', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-21', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-22', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-22', staffName: 'JO', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-22', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-22', staffName: 'HB', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-23', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-23', staffName: 'JO', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-23', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-23', staffName: 'HB', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-23', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-23', staffName: 'Umer', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-24', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-24', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-24', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-08-25', staffName: 'Michael', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-25', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-25', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-25', staffName: 'JO', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-08-26', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-26', staffName: 'Michael', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-26', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-26', staffName: 'Reza', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-26', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-08-27', staffName: 'JO', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-27', staffName: 'sherry', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-27', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-08-28', staffName: 'Michael', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-28', staffName: 'Reza', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-28', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-08-29', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-29', staffName: 'Reza', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-29', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-08-30', staffName: 'Umer', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-30', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-30', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-08-30', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SUNDAY' },
];

/**
 * Exact schedules from September 2026 calendar
 * Format: { date (YYYY-MM-DD), staffName, role, dayOfWeek }
 * ONLY includes entries explicitly shown in PDF - NO MOCK DATA
 * Includes October 1-4 as shown in Sept calendar PDF
 */
export const SEPTEMBER_SCHEDULES = [
  { date: '2026-08-31', staffName: 'Michael', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-01', staffName: 'Umer', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-02', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-05', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-09-05', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-09-06', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Nabeel', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Umer', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Reza', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'JO', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-06', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-07', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-07', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-07', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-07', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-08', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-09', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-09', staffName: 'Umer', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-09', staffName: 'JO', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-10', staffName: 'Michael', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-10', staffName: 'Reza', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-10', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-10', staffName: 'JO', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-11', staffName: 'Reza', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-11', staffName: 'JO', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-12', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-09-13', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Nabeel', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Umer', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Reza', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'JO', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-13', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-14', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-14', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-14', staffName: 'Zack', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-15', staffName: 'Umer', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-15', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-15', staffName: 'Zack', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-16', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-16', staffName: 'Zack', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-16', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-16', staffName: 'JO', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-17', staffName: 'Umer', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-17', staffName: 'Zack', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-18', staffName: 'Zack', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-18', staffName: 'JO', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-18', staffName: 'sherry', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-18', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-19', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-09-20', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-20', staffName: 'Reza', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-20', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-20', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-20', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-21', staffName: 'Michael', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-21', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-22', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-22', staffName: 'Umer', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-22', staffName: 'Reza', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-23', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-23', staffName: 'Zack', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-23', staffName: 'JO', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-24', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-24', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-24', staffName: 'JO', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-09-25', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-25', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-25', staffName: 'JO', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-09-27', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-27', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-27', staffName: 'sherry', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-09-28', staffName: 'Michael', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-28', staffName: 'Reza', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-28', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'MONDAY' },
  { date: '2026-09-29', staffName: 'Umer', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-29', staffName: 'sherry', role: 'Guide', dayOfWeek: 'TUESDAY' },
  { date: '2026-09-30', staffName: 'Tiziano', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  { date: '2026-09-30', staffName: 'JO', role: 'Guide', dayOfWeek: 'WEDNESDAY' },
  // October dates shown in September calendar
  { date: '2026-10-01', staffName: 'Zack', role: 'Guide', dayOfWeek: 'THURSDAY' },
  { date: '2026-10-02', staffName: 'JO', role: 'Guide', dayOfWeek: 'FRIDAY' },
  { date: '2026-10-03', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SATURDAY' },
  { date: '2026-10-04', staffName: 'Desiree', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Nabeel', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Umer', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Michael', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Reza', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Gunzan', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Zack', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Rihab', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'JO', role: 'Guide', dayOfWeek: 'SUNDAY' },
  { date: '2026-10-04', staffName: 'Kristina', role: 'Guide', dayOfWeek: 'SUNDAY' },
];

// ═══════════════════════════════════════════════════════════════
// INGESTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Ingest users from calendar PDFs with validation
 */
export async function ingestCalendarUsers(): Promise<{ created: number; skipped: number }> {
  throw new Error('Create users through the People screen; bundled credential imports are disabled.');
}

/**
 * Ingest job roles from calendar PDFs
 */
export async function ingestCalendarJobRoles() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`INGESTING JOB ROLES FROM PDFs`);
  console.log(`${'═'.repeat(60)}`);

  const db = getFirestore();
  let created = 0;
  let skipped = 0;

  for (const role of CALENDAR_JOB_ROLES) {
    try {
      const roleRef = doc(db, 'jobRoles', role.id);
      const now = new Date().toISOString();

      await setDoc(roleRef, {
        id: role.id,
        name: role.name,
        color: role.color,
        isHidden: false,
        shiftStartTime: role.shiftStartTime,
        shiftEndTime: role.shiftEndTime,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });

      console.log(`✓ Created role: ${role.name}`);
      created++;
    } catch (err) {
      console.error(`✗ Role ${role.name}: ${(err instanceof Error ? err.message : String(err))}`);
      skipped++;
    }
  }

  console.log(`\nRoles ingested: ${created} created, ${skipped} failed`);
  console.log(`${'═'.repeat(60)}\n`);

  return { created, skipped };
}

/**
 * Ingest schedules from both August and September calendars
 */
export async function ingestCalendarSchedules() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`INGESTING SCHEDULES FROM PDFs (AUGUST + SEPTEMBER)`);
  console.log(`${'═'.repeat(60)}`);

  const db = getFirestore();
  const allSchedules = [...AUGUST_SCHEDULES, ...SEPTEMBER_SCHEDULES];
  let created = 0;
  let skipped = 0;

  for (const schedule of allSchedules) {
    try {
      const scheduleRef = doc(collection(db, 'schedules'));
      const [year, month] = schedule.date.split('-').map(Number);
      const now = new Date().toISOString();

      await setDoc(scheduleRef, {
        date: schedule.date,
        dayOfWeek: schedule.dayOfWeek,
        guide: schedule.staffName,
        role: schedule.role,
        month,
        year,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`✓ Schedule: ${schedule.date} - ${schedule.staffName} (${schedule.role})`);
      created++;
    } catch (err) {
      console.error(`✗ Schedule ${schedule.date}: ${(err instanceof Error ? err.message : String(err))}`);
      skipped++;
    }
  }

  console.log(`\nSchedules ingested: ${created} created, ${skipped} failed`);
  console.log(`${'═'.repeat(60)}\n`);

  return { created, skipped };
}

/**
 * Complete calendar ingestion: users → roles → schedules
 */
export async function ingestAllCalendarData() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🗓️  FULL CALENDAR DATA INGESTION - PDFs ONLY`);
  console.log(`August & September Calendars → Firestore`);
  console.log(`${'═'.repeat(60)}`);

  try {
    const userResult = await ingestCalendarUsers();
    const roleResult = await ingestCalendarJobRoles();
    const scheduleResult = await ingestCalendarSchedules();

    const totalCreated = userResult.created + roleResult.created + scheduleResult.created;
    const totalFailed = userResult.skipped + roleResult.skipped + scheduleResult.skipped;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✓ INGESTION COMPLETE`);
    console.log(`Total created: ${totalCreated}`);
    console.log(`Total failed: ${totalFailed}`);
    console.log(`${'═'.repeat(60)}\n`);

    return { totalCreated, totalFailed, success: totalFailed === 0 };
  } catch (err) {
    console.error(`\n✗ INGESTION FAILED:`, err);
    throw err;
  }
}

// Expose to window for development testing
if (import.meta.env.MODE === 'development') {
  window.ingestAllCalendarData = ingestAllCalendarData;
  console.log('💡 Dev tip: Type "await ingestAllCalendarData()" in the console to ingest calendar data');
}
