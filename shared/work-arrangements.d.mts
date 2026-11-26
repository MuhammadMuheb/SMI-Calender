export type WorkMode = 'on_site' | 'wfh' | 'remote' | 'hybrid';
export type DailyMode = Exclude<WorkMode, 'hybrid'>;
export interface WorkPolicy {
  version: number; approvalRequired: boolean; eligible: boolean; allowedModes: WorkMode[];
  workingDays: number[]; mandatoryOfficeDays: number[]; minOfficeDays: number; maxWfhDaysPerMonth: number | null;
  remoteAllowed: boolean; allowedCountries: string[]; locationValidation: Record<DailyMode, 'none' | 'office' | 'coordinates'>;
  enforceHours: boolean; earlyCheckInMinutes: number; graceMinutes: number; timezone: string;
  shiftStart: string; shiftEnd: string; splitTime: string; department?: string;
  employees?: Record<string, Partial<Omit<WorkPolicy, 'employees'>>>;
}
export interface Arrangement {
  id: string; userId: string; userName?: string; requesterRole?: string; mode: WorkMode;
  kind: 'single' | 'half' | 'multi' | 'recurring' | 'temporary' | 'permanent';
  startDate: string; endDate: string | null; portion: 'full' | 'am' | 'pm'; weekdays: number[];
  schedule: Record<number, DailyMode>; hybridStyle: 'fixed' | 'flexible'; timezone: string;
  shiftStart: string; shiftEnd: string; splitTime: string; location?: string; city?: string; country?: string; reason?: string;
  parentId: string | null; status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'revoked';
  version: number; createdAt: string; updatedAt?: string; approvedAt?: string | null; endedAt?: string | null; decisionNote?: string;
}
export interface WorkSlot {
  portion: 'am' | 'pm'; mode: DailyMode | 'off'; reason: string | null; arrangementId: string | null; hybrid: boolean;
  timezone: string; shiftStart: string; shiftEnd: string; splitTime: string; location: string; endedAt: string | null;
}
export interface ScheduleContext {
  leaves?: { userId: string; date: string; status: string }[];
  holidays?: { date: string; isRecurring?: boolean }[];
  specialDays?: { date: string; appliesToAll: boolean; appliesTo?: string[] }[];
}
export const MODES: WorkMode[];
export function hasExecutiveRole(userId: string, assignments: { userId: string; jobRoleId: string }[], roles: { id: string; leavePolicy?: string }[]): boolean;
export function isWeekend(date: string): boolean;
export function weekendDates(start: string, end: string): string[];
export function executiveLeaveError(date: string, type: string): string | null;
export const DEFAULT_POLICY: WorkPolicy;
export function validDate(value: unknown): boolean;
export function addDays(date: string, count: number): string;
export function weekday(date: string): number;
export function localParts(instant: Date | string | number, timezone?: string): { date: string; time: string };
export function atLocal(date: string, time: string, timezone?: string): Date;
export function effectivePolicy(policy: Partial<WorkPolicy>, userId?: string): WorkPolicy;
export function resolveDay(userId: string, date: string, arrangements?: Arrangement[], policy?: WorkPolicy, context?: ScheduleContext): WorkSlot[];
export function currentSchedule(userId: string, now: Date, arrangements: Arrangement[], policy: WorkPolicy, context?: ScheduleContext): WorkSlot & { date: string; start: string; end: string; withinHours: boolean };
