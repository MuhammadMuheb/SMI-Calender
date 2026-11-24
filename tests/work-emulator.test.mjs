import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mutate, read } from '../server/work-arrangements.cjs';
import { attendanceAction } from '../server/work-attendance.cjs';
import { runWorkReminders } from '../server/work-reminders.cjs';
import { DEFAULT_POLICY } from '../shared/work-arrangements.mjs';
import { execFileSync } from 'node:child_process';
assert(process.env.FIRESTORE_EMULATOR_HOST, 'Production writes are forbidden');
const app = initializeApp({ projectId: 'demo-smi-calendar' }, 'work-tests');
const db = getFirestore(app);
const now = new Date('2026-11-24T09:00:00Z');
const staff = { id: 'wa', displayName: 'Work Staff', role: 'staff', isActive: true };
const manager = { id: 'wm', displayName: 'Work Manager', role: 'manager', isActive: true };
const admin = { id: 'wr', displayName: 'Work Admin', role: 'super_admin', isActive: true };
const input = { mode: 'wfh', kind: 'single', startDate: '2026-11-25', location: 'Private home', reason: 'Private reason' };
before(async () => {
  for (const col of await db.listCollections()) for (const doc of (await col.get()).docs) await doc.ref.delete();
  for (const u of [staff, manager, admin]) await db.collection('users').doc(u.id).set(u);
  await db.collection('work_policies').doc('global').set(DEFAULT_POLICY);
  await db.collection('locations').doc('office').set({ name: 'Office', latitude: 41.9, longitude: 12.5, radius_meters: 100, isActive: true });
});
after(async () => { await db.terminate(); await deleteApp(app); });
test('simultaneous requests serialize on an empty schedule and only one survives', async () => {
  const results = await Promise.allSettled([1, 2].map(() => mutate(db, staff, { action: 'request', data: input }, now)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  const requests = await db.collection('work_arrangements').where('userId', '==', staff.id).get();
  assert.equal(requests.size, 1);
  assert.equal((await db.collection('work_calendar').get()).size, 0, 'Pending schedules are private');
});
let approved;
test('approval rechecks role, eligibility and version; history and public projection are atomic', async () => {
  const request = (await read(db, staff, { action: 'list' })).arrangements[0];
  await assert.rejects(mutate(db, staff, { action: 'approve', id: request.id, expectedVersion: 1 }, now), e => e.status === 403);
  await assert.rejects(mutate(db, manager, { action: 'approve', id: request.id, expectedVersion: 99 }, now), e => e.status === 409);
  approved = (await mutate(db, manager, { action: 'approve', id: request.id, expectedVersion: 1 }, now)).arrangement;
  const publicRecord = (await db.collection('work_calendar').doc(request.id).get()).data();
  assert.equal(publicRecord.mode, 'wfh');
  assert.equal(publicRecord.reason, undefined);
  assert.equal(publicRecord.location, undefined);
  assert.equal((await read(db, staff, { action: 'history', id: request.id })).history.length, 2);
  await assert.rejects(mutate(db, manager, { action: 'reject', id: request.id, expectedVersion: 1, note: 'Stale decision' }, now), e => e.status === 409);
});
test('managers cannot self-approve or assign another manager, and staff cannot inspect colleagues', async () => {
  const request = (await mutate(db, manager, { action: 'request', data: input }, now)).arrangement;
  await assert.rejects(mutate(db, manager, { action: 'approve', id: request.id, expectedVersion: 1 }, now), e => e.status === 403);
  await assert.rejects(mutate(db, manager, { action: 'assign', data: { ...input, userId: admin.id } }, now), e => e.status === 403);
  await assert.rejects(read(db, staff, { action: 'history', id: request.id }), e => e.status === 403);
  assert(!(await read(db, staff, { action: 'list' })).arrangements.some(a => a.userId === manager.id));
  await mutate(db, admin, { action: 'approve', id: request.id, expectedVersion: 1 }, now);
});
test('check-ins use server mode/time, reject duplicates and enforce office geofence', async () => {
  const when = new Date('2026-11-25T09:00:00Z');
  const results = await Promise.allSettled([1, 2].map(() => attendanceAction(db, staff, { action: 'check-in', data: { workType: 'remote', checkInAt: '2000-01-01', userId: admin.id } }, when)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const active = results.find(r => r.status === 'fulfilled').value.active;
  assert.equal(active.userId, staff.id); assert.equal(active.workType, 'wfh'); assert.equal(active.checkInAt, when.toISOString());
  await attendanceAction(db, staff, { action: 'check-out' }, new Date('2026-11-25T12:00:00Z'));
  await assert.rejects(attendanceAction(db, staff, { action: 'check-in', data: { locationId: 'office', latitude: 0, longitude: 0 } }, new Date('2026-11-26T09:00:00Z')), /outside/);
  await attendanceAction(db, staff, { action: 'check-in', data: { locationId: 'office', latitude: 41.9, longitude: 12.5 } }, new Date('2026-11-26T09:00:00Z'));
  await attendanceAction(db, staff, { action: 'check-out' }, new Date('2026-11-26T12:00:00Z'));
});
test('half-day changes create auditable attendance segments and revocation closes the active segment', async () => {
  const a = (await mutate(db, admin, { action: 'assign', data: { ...input, startDate: '2026-11-27', kind: 'half', portion: 'pm', userId: staff.id } }, now)).arrangement;
  const morning = await attendanceAction(db, staff, { action: 'check-in', data: { locationId: 'office', latitude: 41.9, longitude: 12.5 } }, new Date('2026-11-27T09:00:00Z'));
  const afternoon = await attendanceAction(db, staff, { action: 'switch-mode' }, new Date('2026-11-27T13:00:00Z'));
  assert.equal(afternoon.active.workType, 'wfh');
  assert.equal((await db.collection('check_ins').doc(morning.active.id).get()).data().checkOutAt, '2026-11-27T13:00:00.000Z');
  await mutate(db, admin, { action: 'revoke', id: a.id, expectedVersion: a.version, note: 'Office cover needed' }, new Date('2026-11-27T14:00:00Z'));
  assert.equal((await db.collection('check_ins').doc(afternoon.active.id).get()).data().checkOutAt, '2026-11-27T14:00:00.000Z');
});
test('approved sick leave wins even after an arrangement was approved', async () => {
  await db.collection('leave_requests').doc('work-sick').set({ userId: staff.id, date: '2026-11-25', status: 'approved', leaveType: 'sick_day' });
  await assert.rejects(attendanceAction(db, staff, { action: 'check-in' }, new Date('2026-11-25T14:00:00Z')), /Approved leave/);
});
test('policy version conflicts, auto approval and mandatory office days are enforced', async () => {
  await assert.rejects(mutate(db, manager, { action: 'policy', data: DEFAULT_POLICY, expectedVersion: 1 }, now), e => e.status === 403);
  await mutate(db, admin, { action: 'policy', data: { ...DEFAULT_POLICY, approvalRequired: false, mandatoryOfficeDays: [1] }, expectedVersion: 1 }, now);
  await assert.rejects(mutate(db, admin, { action: 'policy', data: DEFAULT_POLICY, expectedVersion: 1 }, now), e => e.status === 409);
  await assert.rejects(mutate(db, staff, { action: 'request', data: { ...input, startDate: '2026-11-30' } }, now), /Mandatory office/);
  const a = (await mutate(db, staff, { action: 'request', data: { ...input, startDate: '2026-12-01' } }, now)).arrangement;
  assert.equal(a.status, 'approved');
});
test('reminders are deduplicated and skip approved leave', async () => {
  await runWorkReminders(db, new Date('2026-11-25T10:00:00Z'));
  await runWorkReminders(db, new Date('2026-11-25T10:00:00Z'));
  const all = (await db.collection('notifications').get()).docs;
  assert.equal(all.filter(n => n.id.startsWith('work_missing_wa_2026-11-25')).length, 0);
  assert.equal(all.filter(n => n.id.startsWith('work_missing_wm_2026-11-25')).length, 2);
});
test('additive migration is dry-run safe and idempotent without overwriting policy', async () => {
  const before = (await db.collection('work_policies').doc('global').get()).data();
  const run = args => JSON.parse(execFileSync(process.execPath, ['scripts/migrate-work-arrangements.mjs', ...args], { env: { ...process.env, FIREBASE_PROJECT_ID: 'demo-smi-calendar' }, encoding: 'utf8' }));
  assert.equal(run([]).changed, false);
  assert.equal((await db.collection('schema_migrations').doc('20261124_work_arrangements').get()).exists, false);
  assert.equal(run(['--apply']).changed, true);
  assert.equal(run(['--apply']).changed, false);
  assert.deepEqual((await db.collection('work_policies').doc('global').get()).data(), before);
});
