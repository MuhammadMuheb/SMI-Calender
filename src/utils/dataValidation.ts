import type { StaffUser, UserRef } from '@/models/user';
import type { LeaveRequest, LeaveType, LeaveStatus } from '@/models/leave';
import type { Role } from '@/config/roles';
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function role(value: unknown): Role { return value === 'manager' || value === 'super_admin' || value === 'spectator' ? value : 'staff'; }
export function getDisplayName(value: unknown): string {
  if (typeof value === 'string') return value.trim() || 'Unknown User';
  const u = asRecord(value);
  return text(u.displayName ?? u.name ?? u.display_name ?? u.userName ?? u.username, 'Unknown User');
}
export function getUserId(value: unknown): string {
  const u = asRecord(value); return text(u.id ?? u.userId ?? u.user_id, 'unknown');
}
export function getUserRef(value: unknown): UserRef {
  return { id: getUserId(value), displayName: getDisplayName(value), role: role(asRecord(value).role) };
}
export function validateUser(value: unknown): StaffUser {
  const u = asRecord(value);
  const jobs = u.jobRole ?? u.job_role;
  return { id: getUserId(u), username: text(u.username ?? u.userName, 'unknown'), displayName: getDisplayName(u), pin: '',
    role: role(u.role), isActive: Object.keys(u).length > 0 && u.isActive !== false && u.is_active !== false,
    createdAt: text(u.createdAt ?? u.created_at), updatedAt: text(u.updatedAt ?? u.updated_at),
    vacationOverride: typeof u.vacationOverride === 'number' ? u.vacationOverride : null,
    regularOverride: typeof u.regularOverride === 'number' ? u.regularOverride : null,
    jobRole: Array.isArray(jobs) ? jobs.filter((v): v is string => typeof v === 'string') : [] };
}
export function validateUsers(values: unknown): StaffUser[] {
  return Array.isArray(values) ? values.filter(v => { const u = asRecord(v); return !!(u.id || u.userId || u.username); }).map(validateUser) : [];
}
export function validateLeaveRequest(value: unknown): LeaveRequest | null {
  const r = asRecord(value);
  if (!Object.keys(r).length) return null;
  const type = text(r.leaveType ?? r.leave_type ?? r.type);
  const aliases: Record<string, LeaveType> = { day_off: 'regular_day_off', vacation: 'paid_vacation', sick: 'sick_day' };
  const types: LeaveType[] = ['regular_day_off','paid_vacation','sick_day','auto_assigned','auto_sunday','special_day'];
  const leaveType = aliases[type] ?? (types.includes(type as LeaveType) ? type as LeaveType : 'regular_day_off');
  const states: LeaveStatus[] = ['pending','approved','rejected','cancelled'];
  const status = states.includes(r.status as LeaveStatus) ? r.status as LeaveStatus : 'pending';
  const userId = text(r.userId ?? r.user_id, 'unknown');
  return { id: text(r.id), userId, userRef: r.userRef ? getUserRef(r.userRef) : getUserRef({ id: userId, displayName: r.user_display_name ?? r.userName, role: r.user_role }),
    date: text(r.date), leaveType, status, staffNote: text(r.staffNote ?? r.staff_note), approverNote: text(r.approverNote ?? r.approver_note),
    decidedBy: r.decidedBy || r.decided_by ? getUserRef(r.decidedBy ?? r.decided_by) : null,
    decidedAt: text(r.decidedAt ?? r.decided_at) || null,
    isOverridden: r.isOverridden === true || r.is_overridden === true,
    overriddenBy: r.overriddenBy || r.overridden_by ? getUserRef(r.overriddenBy ?? r.overridden_by) : null,
    overriddenAt: text(r.overriddenAt ?? r.overridden_at) || null,
    createdAt: text(r.createdAt ?? r.created_at), updatedAt: text(r.updatedAt ?? r.updated_at) };
}
export function validateLeaveRequests(values: unknown): LeaveRequest[] {
  return Array.isArray(values) ? values.map(validateLeaveRequest).filter((v): v is LeaveRequest => v !== null) : [];
}
export function safeMapUsers<T>(values: unknown, mapper: (user: StaffUser) => T): T[] { return validateUsers(values).map(mapper); }
export function safeMapRequests<T>(values: unknown, mapper: (request: LeaveRequest) => T): T[] { return validateLeaveRequests(values).map(mapper); }
