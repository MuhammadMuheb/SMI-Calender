import { supabase } from '../lib/supabase';
import type { Role } from '../config/roles';

/**
 * Supabase database service layer.
 * All database reads/writes go through here.
 *
 * NOTE: login currently authenticates by comparing the PIN directly against
 * `users.pin_hash` (plaintext). A Supabase-Auth-based login (real per-user
 * session -> real RLS) would be a better long-term fix for the "RLS is
 * cosmetic" problem, but that rollout (supabase-security-migration-part1/
 * part2.sql + scripts/migrate-users-to-auth.mjs) is on hold and its
 * migration script is disabled — do not re-enable or run any part of it
 * without also switching this function to `supabase.auth.signInWithPassword`
 * in the same change, or every existing user's PIN gets destroyed with no
 * way left to authenticate them.
 */
export async function authenticateUser(username: string, pin: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .eq('pin_hash', pin)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    username: data.username as string,
    displayName: (data.display_name ?? data.username ?? 'Unknown User') as string,
    role: data.role as Role,
    jobRole: (data.job_role ?? ["Office"]) as string[],
  };
}

// ─── Users ────────────────────────────────────────────────

export async function fetchUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchUsers:', error); return []; }
  return data.map(mapUser);
}

export async function insertUser(user: {
  id: string; username: string; displayName: string; pin: string; role: Role;
}) {
  // pin_hash stores the plaintext PIN — the new user can log in immediately
  // with it. Do NOT run scripts/migrate-users-to-auth.mjs "to finish setting
  // them up" — that script is disabled because it overwrites this column and
  // permanently breaks login (see the NOTE on authenticateUser above).
  const { error } = await supabase.from('users').insert({
    id: user.id, username: user.username, display_name: user.displayName,
    pin_hash: user.pin, role: user.role, is_active: true,
  });
  if (error) console.error('insertUser ERROR:', error.message, error.details);
  return user.id;
}

export async function updateUserDb(id: string, updates: Record<string, unknown>) {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('displayName' in updates) mapped.display_name = updates.displayName;
  if ('role' in updates) mapped.role = updates.role;
  if ('isActive' in updates) mapped.is_active = updates.isActive;
  if ('pin' in updates) mapped.pin_hash = updates.pin;
  if ('vacation_override' in updates) mapped.vacation_override = updates.vacation_override;
  if ('vacation_override_at' in updates) mapped.vacation_override_at = updates.vacation_override_at;
  if ('regular_override' in updates) mapped.regular_override = updates.regular_override;
  const { error } = await supabase.from('users').update(mapped).eq('id', id);
  if (error) console.error('updateUser:', error);
}

export async function deleteUserDb(id: string) {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) console.error('deleteUser:', error);
}

// ─── Leave Requests ───────────────────────────────────────

export async function fetchLeaveRequests() {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchLeaveRequests:', error); return []; }
  return data.map(mapLeaveRequest);
}

export async function insertLeaveRequest(req: {
  userId: string; userDisplayName: string; userRole: string;
  date: string; leaveType: string; status: string;
  staffNote?: string; approverNote?: string;
  decidedById?: string; decidedByName?: string;
}) {
  const id = `lr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const row: Record<string, unknown> = {
    id,
    user_id: req.userId,
    user_display_name: req.userDisplayName,
    user_role: req.userRole,
    date: req.date,
    leave_type: req.leaveType,
    status: req.status,
    staff_note: req.staffNote ?? '',
    approver_note: req.approverNote ?? '',
    is_overridden: false,
  };
  // Only include decided fields if they have values
  if (req.decidedById) {
    row.decided_by_id = req.decidedById;
    row.decided_by_name = req.decidedByName ?? '';
    row.decided_at = new Date().toISOString();
  }
  const { error } = await supabase.from('leave_requests').insert(row);
  if (error) {
    console.error('insertLeaveRequest ERROR:', error.message, error.details, error.hint);
  }
  return id;
}

export async function updateLeaveRequestDb(id: string, updates: Record<string, unknown>) {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('status' in updates) mapped.status = updates.status;
  if ('approverNote' in updates) mapped.approver_note = updates.approverNote;
  if ('decidedById' in updates) mapped.decided_by_id = updates.decidedById;
  if ('decidedByName' in updates) mapped.decided_by_name = updates.decidedByName;
  if ('decidedAt' in updates) mapped.decided_at = updates.decidedAt;
  if ('isOverridden' in updates) mapped.is_overridden = updates.isOverridden;
  if ('overriddenById' in updates) mapped.overridden_by_id = updates.overriddenById;
  if ('overriddenByName' in updates) mapped.overridden_by_name = updates.overriddenByName;
  if ('overriddenAt' in updates) mapped.overridden_at = updates.overriddenAt;
  const { error } = await supabase.from('leave_requests').update(mapped).eq('id', id);
  if (error) console.error('updateLeaveRequest:', error);
}

// ─── Job Roles ────────────────────────────────────────────

export async function fetchJobRoles() {
  const { data, error } = await supabase.from('job_roles').select('*').order('name');
  if (error) { console.error('fetchJobRoles:', error); return []; }
  return data.map(mapJobRole);
}

export async function insertJobRole(role: {
  id: string; name: string; color: string; isHidden: boolean; shiftStart: string; shiftEnd: string;
}) {
  const { error } = await supabase.from('job_roles').insert({
    id: role.id, name: role.name, color: role.color, is_hidden: role.isHidden,
    shift_start: role.shiftStart, shift_end: role.shiftEnd,
  });
  if (error) console.error('insertJobRole ERROR:', error.message, error.details);
  return role.id;
}

export async function updateJobRoleDb(id: string, updates: Record<string, unknown>) {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('isHidden' in updates) mapped.is_hidden = updates.isHidden;
  if ('name' in updates) mapped.name = updates.name;
  if ('color' in updates) mapped.color = updates.color;
  const { error } = await supabase.from('job_roles').update(mapped).eq('id', id);
  if (error) console.error('updateJobRole:', error);
}

export async function deleteJobRoleDb(id: string) {
  await supabase.from('staff_role_assignments').delete().eq('job_role_id', id);
  const { error } = await supabase.from('job_roles').delete().eq('id', id);
  if (error) console.error('deleteJobRole:', error);
}

// ─── Role Assignments ─────────────────────────────────────

export async function fetchRoleAssignments() {
  const { data, error } = await supabase.from('staff_role_assignments').select('*');
  if (error) { console.error('fetchRoleAssignments:', error); return []; }
  return data.map(mapRoleAssignment);
}

// ─── Staffing Rules ───────────────────────────────────────

export async function fetchStaffingRules() {
  const { data, error } = await supabase.from('staffing_rules').select('*');
  if (error) { console.error('fetchStaffingRules:', error); return []; }
  return data.map(mapStaffingRule);
}

export async function insertStaffingRule(rule: {
  id: string; jobRoleId: string; dayOfWeek: number | null; minimumRequired: number; enforcement: string;
}) {
  const { error } = await supabase.from('staffing_rules').insert({
    id: rule.id, job_role_id: rule.jobRoleId, day_of_week: rule.dayOfWeek,
    minimum_required: rule.minimumRequired, enforcement: rule.enforcement,
  });
  if (error) console.error('insertStaffingRule ERROR:', error.message, error.details);
  return rule.id;
}

export async function updateStaffingRuleDb(id: string, updates: Record<string, unknown>) {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('enforcement' in updates) mapped.enforcement = updates.enforcement;
  if ('minimumRequired' in updates) mapped.minimum_required = updates.minimumRequired;
  const { error } = await supabase.from('staffing_rules').update(mapped).eq('id', id);
  if (error) console.error('updateStaffingRule:', error);
}

export async function deleteStaffingRuleDb(id: string) {
  const { error } = await supabase.from('staffing_rules').delete().eq('id', id);
  if (error) console.error('deleteStaffingRule:', error);
}

// ─── Holidays & Special Days ──────────────────────────────

export async function fetchHolidays() {
  const { data, error } = await supabase.from('holidays').select('*').order('date');
  if (error) { console.error('fetchHolidays:', error); return []; }
  return data.map(mapHoliday);
}

export async function fetchSpecialDays() {
  const { data, error } = await supabase.from('special_days').select('*').order('date');
  if (error) { console.error('fetchSpecialDays:', error); return []; }
  return data.map(mapSpecialDay);
}

export async function insertSpecialDay(day: {
  id: string; name: string; date: string; consumesBalance: boolean;
  appliesToAll: boolean; appliesTo: string[]; createdBy: string;
}) {
  const { error } = await supabase.from('special_days').insert({
    id: day.id, name: day.name, date: day.date, consumes_balance: day.consumesBalance,
    applies_to_all: day.appliesToAll, applies_to: day.appliesTo, created_by: day.createdBy,
  });
  if (error) console.error('insertSpecialDay ERROR:', error.message, error.details);
  return day.id;
}

export async function deleteSpecialDayDb(id: string) {
  const { error } = await supabase.from('special_days').delete().eq('id', id);
  if (error) console.error('deleteSpecialDay:', error);
}

// ─── Tour Assignments ─────────────────────────────────────

export async function fetchTourAssignments() {
  const { data, error } = await supabase.from('tour_assignments').select('*').order('date');
  if (error) { console.error('fetchTourAssignments:', error); return []; }
  return data.map(mapTourAssignment);
}

export async function upsertTourAssignments(rows: {
  id: string; userId: string; date: string; source: string; note?: string;
}[]) {
  const { error } = await supabase.from('tour_assignments').upsert(
    rows.map((r) => ({
      id: r.id, user_id: r.userId, date: r.date, source: r.source, note: r.note ?? '',
    })),
    { onConflict: 'user_id,date' },
  );
  if (error) console.error('upsertTourAssignments ERROR:', error.message, error.details);
}

// ─── Audit Log ────────────────────────────────────────────

export async function insertAuditLog(entry: {
  actorId: string; actorName: string; action: string;
  entityType: string; entityId: string; description: string;
  oldValue?: unknown; newValue?: unknown;
}) {
  const { error } = await supabase.from('audit_log').insert({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actor_id: entry.actorId, actor_name: entry.actorName,
    action: entry.action, entity_type: entry.entityType,
    entity_id: entry.entityId, description: entry.description,
    old_value: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
    new_value: entry.newValue ? JSON.stringify(entry.newValue) : null,
  });
  if (error) console.error('insertAuditLog:', error);
}

export async function fetchAuditLog() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(200);
  if (error) { console.error('fetchAuditLog:', error); return []; }
  return data.map(mapAuditEntry);
}

// ─── Notification Settings ────────────────────────────────

export async function fetchNotificationSettings() {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error || !data) return { dailyReminderTime: '14:00', dailyReminderEnabled: true, updatedAt: '', updatedBy: '' };
  return {
    dailyReminderTime: data.daily_reminder_time as string,
    dailyReminderEnabled: data.daily_reminder_enabled as boolean,
    updatedAt: data.updated_at as string,
    updatedBy: data.updated_by as string,
  };
}

export async function updateNotificationSettingsDb(updates: {
  dailyReminderTime?: string; dailyReminderEnabled?: boolean;
  updatedBy: string;
}) {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: updates.updatedBy };
  if (updates.dailyReminderTime !== undefined) mapped.daily_reminder_time = updates.dailyReminderTime;
  if (updates.dailyReminderEnabled !== undefined) mapped.daily_reminder_enabled = updates.dailyReminderEnabled;
  const { error } = await supabase.from('notification_settings').update(mapped).eq('id', 1);
  if (error) console.error('updateNotificationSettings:', error);
}

// ─── Notifications ────────────────────────────────────────

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) { console.error('fetchNotifications:', error); return []; }
  return data.map(mapNotification);
}

export async function fetchNotificationsForUser(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { console.error('fetchNotificationsForUser:', error); return []; }
  return data.map(mapNotification);
}

export async function insertNotification(notif: {
  id: string; userId: string; type: string; title: string; body: string;
  createdBy?: string; entityType?: string; entityId?: string;
}) {
  const { error } = await supabase.from('notifications').insert({
    id: notif.id, user_id: notif.userId, type: notif.type,
    title: notif.title, body: notif.body,
    created_by: notif.createdBy ?? '',
    entity_type: notif.entityType ?? null,
    entity_id: notif.entityId ?? null,
  });
  if (error) console.error('insertNotification ERROR:', error.message, error.details);
  return notif.id;
}

export async function updateNotificationDb(id: string, updates: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  if ('isRead' in updates) mapped.is_read = updates.isRead;
  if ('confirmStatus' in updates) mapped.confirm_status = updates.confirmStatus;
  if ('rejectReason' in updates) mapped.reject_reason = updates.rejectReason;
  const { error } = await supabase.from('notifications').update(mapped).eq('id', id);
  if (error) console.error('updateNotification:', error);
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase.from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) console.error('markAllNotificationsRead:', error);
}

// ─── Mappers (snake_case DB → camelCase app) ──────────────

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    pin: row.pin_hash as string,
    role: row.role as Role,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    vacationOverride: (row.vacation_override as number | null) ?? null,
    vacationOverrideAt: (row.vacation_override_at as string | null) ?? null,
    regularOverride: (row.regular_override as number | null) ?? null,
    jobRole: (row.job_role ?? ["Office"]) as string[],
  };
}

function mapLeaveRequest(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userRef: {
      id: row.user_id as string,
      displayName: row.user_display_name as string,
      role: row.user_role as Role,
    },
    date: (row.date as string).split('T')[0],
    leaveType: row.leave_type as string,
    status: row.status as string,
    staffNote: (row.staff_note ?? '') as string,
    approverNote: (row.approver_note ?? '') as string,
    decidedBy: row.decided_by_id ? {
      id: row.decided_by_id as string,
      displayName: row.decided_by_name as string,
      role: 'manager' as Role,
    } : null,
    decidedAt: row.decided_at as string | null,
    isOverridden: row.is_overridden as boolean,
    overriddenBy: row.overridden_by_id ? {
      id: row.overridden_by_id as string,
      displayName: row.overridden_by_name as string,
      role: 'super_admin' as Role,
    } : null,
    overriddenAt: row.overridden_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapJobRole(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    isHidden: row.is_hidden as boolean,
    shiftStartTime: row.shift_start as string,
    shiftEndTime: row.shift_end as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRoleAssignment(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    jobRoleId: row.job_role_id as string,
    isPrimary: row.is_primary as boolean,
    assignedAt: row.assigned_at as string,
  };
}

function mapStaffingRule(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    jobRoleId: row.job_role_id as string,
    dayOfWeek: row.day_of_week as number | null,
    minimumRequired: row.minimum_required as number,
    enforcement: row.enforcement as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapHoliday(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    date: (row.date as string).split('T')[0],
    isRecurring: row.is_recurring as boolean,
    createdAt: row.created_at as string,
  };
}

function mapSpecialDay(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    date: (row.date as string).split('T')[0],
    consumesBalance: row.consumes_balance as boolean,
    appliesToAll: row.applies_to_all as boolean,
    appliesTo: (row.applies_to ?? []) as string[],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

function mapTourAssignment(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: (row.date as string).split('T')[0],
    source: row.source as string,
    note: (row.note ?? '') as string,
    createdAt: row.created_at as string,
  };
}

function mapAuditEntry(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    actorId: row.actor_id as string,
    actorName: row.actor_name as string,
    action: row.action as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    description: row.description as string,
    oldValue: row.old_value ? JSON.stringify(row.old_value) : null,
    newValue: row.new_value ? JSON.stringify(row.new_value) : null,
    timestamp: row.timestamp as string,
  };
}

function mapNotification(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as string,
    title: row.title as string,
    body: (row.body ?? '') as string,
    isRead: row.is_read as boolean,
    confirmStatus: (row.confirm_status ?? 'pending') as string,
    rejectReason: (row.reject_reason ?? '') as string,
    entityType: row.entity_type as string | undefined,
    entityId: row.entity_id as string | undefined,
    createdBy: row.created_by as string | undefined,
    createdAt: row.created_at as string,
  };
}
