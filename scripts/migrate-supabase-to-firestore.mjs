#!/usr/bin/env node
/**
 * One-time migration: copies every table out of the (soon to be retired)
 * production Supabase project into the Firestore project the Admin SDK is
 * pointed at (see scripts/lib/firebaseAdmin.mjs for how to target one).
 *
 * Reads from Supabase are READ-ONLY — this never writes back to Supabase.
 * Firestore writes only happen with --apply; the default is a dry run that
 * prints exactly what would be written, per collection.
 *
 * Usage:
 *   node scripts/migrate-supabase-to-firestore.mjs            # dry run
 *   node scripts/migrate-supabase-to-firestore.mjs --apply     # writes
 *
 * IMPORTANT: users.pin_hash is PLAINTEXT in Supabase. This script
 * bcrypt-hashes each PIN during migration so Firestore never stores a
 * plaintext PIN and signInWithPin's bcrypt.compare keeps working.
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { getDb } from './lib/firebaseAdmin.mjs';

const APPLY = process.argv.includes('--apply');

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  ?? 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

// Supabase's REST API caps a single select at 1000 rows by default — page
// through with .range() so large tables (leave_requests, notifications,
// audit_log, check_ins all have 1000+ real rows) don't get silently truncated.
async function fetchAll(supabase, table) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (error) {
      console.log(`   (skipped ${table}: ${error.message})`);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function writeCollection(db, name, docs) {
  console.log(`   writing ${docs.length} docs to "${name}"...`);
  const batchSize = 400;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    for (const { id, data } of docs.slice(i, i + batchSize)) {
      batch.set(db.collection(name).doc(id), data, { merge: true });
    }
    await batch.commit();
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('═══════════════════════════════════════════════════');
  console.log(' SUPABASE → FIRESTORE MIGRATION');
  console.log(` Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (read-only)'}`);
  console.log('═══════════════════════════════════════════════════\n');

  // ── Users (bcrypt-hash the plaintext PIN) ──────────────────
  const users = await fetchAll(supabase, 'users');
  const usersOut = await Promise.all(users.map(async (u) => ({
    id: u.username.toLowerCase(),
    data: {
      id: u.id, username: u.username.toLowerCase(), displayName: u.display_name,
      pinHash: await bcrypt.hash(u.pin_hash, 10), // pin_hash is plaintext in Supabase
      role: u.role, isActive: u.is_active, jobRole: u.job_role ?? [],
      vacationOverride: u.vacation_override ?? null, vacationOverrideAt: u.vacation_override_at ?? null,
      regularOverride: u.regular_override ?? null,
      createdAt: u.created_at, updatedAt: u.updated_at,
    },
  })));
  console.log(`users: ${usersOut.length} rows (PINs re-hashed with bcrypt)`);

  // Maps used to denormalize check_ins below.
  const userById = new Map(users.map((u) => [u.id, u]));

  // ── Simple 1:1 renames ──────────────────────────────────────
  const jobRoles = await fetchAll(supabase, 'job_roles');
  const jobRolesOut = jobRoles.map((r) => ({ id: r.id, data: {
    name: r.name, color: r.color, isHidden: r.is_hidden,
    shiftStart: r.shift_start, shiftEnd: r.shift_end, createdAt: r.created_at, updatedAt: r.updated_at,
  } }));

  const roleAssignments = await fetchAll(supabase, 'staff_role_assignments');
  const roleAssignmentsOut = roleAssignments.map((a) => ({ id: a.id, data: {
    userId: a.user_id, jobRoleId: a.job_role_id, isPrimary: a.is_primary, assignedAt: a.assigned_at,
  } }));

  const staffingRules = await fetchAll(supabase, 'staffing_rules');
  const staffingRulesOut = staffingRules.map((r) => ({ id: r.id, data: {
    jobRoleId: r.job_role_id, dayOfWeek: r.day_of_week, minimumRequired: r.minimum_required,
    enforcement: r.enforcement, createdAt: r.created_at, updatedAt: r.updated_at,
  } }));

  const holidays = await fetchAll(supabase, 'holidays');
  const holidaysOut = holidays.map((h) => ({ id: h.id, data: {
    name: h.name, date: h.date, isRecurring: h.is_recurring, createdAt: h.created_at,
  } }));

  const specialDays = await fetchAll(supabase, 'special_days');
  const specialDaysOut = specialDays.map((s) => ({ id: s.id, data: {
    name: s.name, date: s.date, consumesBalance: s.consumes_balance, appliesToAll: s.applies_to_all,
    appliesTo: s.applies_to ?? [], createdBy: s.created_by, createdAt: s.created_at,
  } }));

  const leaveRequests = await fetchAll(supabase, 'leave_requests');
  const leaveRequestsOut = leaveRequests.map((r) => ({ id: r.id, data: {
    userId: r.user_id, userDisplayName: r.user_display_name, userRole: r.user_role,
    date: r.date, leaveType: r.leave_type, status: r.status,
    staffNote: r.staff_note ?? '', approverNote: r.approver_note ?? '',
    decidedById: r.decided_by_id ?? null, decidedByName: r.decided_by_name ?? null, decidedAt: r.decided_at ?? null,
    isOverridden: r.is_overridden, overriddenById: r.overridden_by_id ?? null,
    overriddenByName: r.overridden_by_name ?? null, overriddenAt: r.overridden_at ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  } }));

  const notifications = await fetchAll(supabase, 'notifications');
  const notificationsOut = notifications.map((n) => ({ id: n.id, data: {
    userId: n.user_id, type: n.type, title: n.title, body: n.body ?? '',
    isRead: n.is_read, confirmStatus: n.confirm_status ?? 'pending', rejectReason: n.reject_reason ?? '',
    createdBy: n.created_by ?? '', entityType: n.entity_type ?? null, entityId: n.entity_id ?? null,
    createdAt: n.created_at,
  } }));

  const notificationSettings = await fetchAll(supabase, 'notification_settings');
  const notificationSettingsOut = notificationSettings.map(() => ({ id: 'global', data: {
    dailyReminderTime: notificationSettings[0].daily_reminder_time,
    dailyReminderEnabled: notificationSettings[0].daily_reminder_enabled,
    updatedAt: notificationSettings[0].updated_at, updatedBy: notificationSettings[0].updated_by,
  } })).slice(0, 1);

  const auditLog = await fetchAll(supabase, 'audit_log');
  const auditLogOut = auditLog.map((a) => ({ id: a.id, data: {
    actorId: a.actor_id, actorName: a.actor_name, action: a.action,
    entityType: a.entity_type, entityId: a.entity_id, description: a.description,
    oldValue: a.old_value ?? null, newValue: a.new_value ?? null, timestamp: a.timestamp,
  } }));

  const tourAssignments = await fetchAll(supabase, 'tour_assignments');
  const tourAssignmentsOut = tourAssignments.map((t) => ({ id: t.id, data: {
    userId: t.user_id, date: t.date, source: t.source, note: t.note ?? '', createdAt: t.created_at,
  } }));

  // ── Locations, then check_ins denormalized against users+locations ──
  const locations = await fetchAll(supabase, 'locations');
  const locationsOut = locations.map((l) => ({ id: l.id, data: {
    name: l.name, address: l.address ?? null, latitude: l.latitude, longitude: l.longitude,
    radiusMeters: l.radius_meters, isActive: l.is_active, allowedRoles: l.allowed_roles ?? [],
    createdAt: l.created_at,
  } }));
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const checkIns = await fetchAll(supabase, 'check_ins');
  const checkInsOut = checkIns.map((c) => {
    const u = userById.get(c.user_id);
    const loc = locationById.get(c.location_id);
    return { id: c.id, data: {
      userId: c.user_id, userName: u?.display_name ?? 'Unknown', jobRole: u?.job_role ?? ['Office'],
      locationId: c.location_id ?? '', locationName: loc?.name ?? 'Unknown',
      checkInAt: c.check_in_at, checkOutAt: c.check_out_at ?? null,
      checkInLat: c.check_in_lat ?? null, checkInLng: c.check_in_lng ?? null,
      checkOutLat: c.check_out_lat ?? null, checkOutLng: c.check_out_lng ?? null,
      isWfh: c.is_wfh, workType: c.work_type ?? (c.is_wfh ? 'wfh' : 'on_site'),
      autoCheckedOut: c.auto_checked_out ?? false,
    } };
  });

  const pushSubs = await fetchAll(supabase, 'push_subscriptions');
  const pushSubsOut = pushSubs.map((p) => ({ id: p.id, data: {
    userId: p.user_id, endpoint: p.endpoint, p256dh: p.p256dh, auth: p.auth,
  } }));

  // ── Tasks (kept snake_case, straight pass-through) ──────────
  const tasks = await fetchAll(supabase, 'tasks');
  const tasksOut = tasks.map((t) => ({ id: t.id, data: t }));
  const taskTemplates = await fetchAll(supabase, 'task_templates');
  const taskTemplatesOut = taskTemplates.map((t) => ({ id: t.id, data: t }));
  const taskCategories = await fetchAll(supabase, 'task_categories');
  const taskCategoriesOut = taskCategories.map((t) => ({ id: t.id, data: t }));
  const taskComments = await fetchAll(supabase, 'task_comments');
  const taskCommentsOut = taskComments.map((t) => ({ id: t.id, data: t }));
  const taskActivity = await fetchAll(supabase, 'task_activity');
  const taskActivityOut = taskActivity.map((t) => ({ id: t.id, data: t }));
  const taskAttachments = await fetchAll(supabase, 'task_attachments');
  const taskAttachmentsOut = taskAttachments.map((t) => ({ id: t.id, data: t }));

  const collections = [
    ['users', usersOut], ['job_roles', jobRolesOut], ['staff_role_assignments', roleAssignmentsOut],
    ['staffing_rules', staffingRulesOut], ['holidays', holidaysOut], ['special_days', specialDaysOut],
    ['leave_requests', leaveRequestsOut], ['notifications', notificationsOut],
    ['notification_settings', notificationSettingsOut], ['audit_log', auditLogOut],
    ['tour_assignments', tourAssignmentsOut], ['locations', locationsOut], ['check_ins', checkInsOut],
    ['push_subscriptions', pushSubsOut], ['tasks', tasksOut], ['task_templates', taskTemplatesOut],
    ['task_categories', taskCategoriesOut], ['task_comments', taskCommentsOut],
    ['task_activity', taskActivityOut], ['task_attachments', taskAttachmentsOut],
  ];

  console.log('\nRow counts to migrate:');
  for (const [name, docs] of collections) console.log(`   ${name}: ${docs.length}`);

  if (!APPLY) {
    console.log('\nDry run only — no data was written. Re-run with --apply to write all of the above to Firestore.');
    return;
  }

  console.log('\nApplying — writing to Firestore ...');
  const db = getDb();
  for (const [name, docs] of collections) {
    if (docs.length === 0) continue;
    await writeCollection(db, name, docs);
  }
  console.log('Done.');
}

main();
