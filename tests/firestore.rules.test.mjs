import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-smi-calendar', firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [id, role] of [['staff', 'staff'], ['manager', 'manager'], ['admin', 'super_admin'], ['viewer', 'spectator']]) {
      await setDoc(doc(db, 'users', id), { id, role, isActive: true, username: id });
    }
    await setDoc(doc(db, 'users', 'inactive'), { role: 'super_admin', isActive: false });
    await setDoc(doc(db, 'user_credentials', 'staff'), { pinHash: 'server-only' });
    await setDoc(doc(db, 'staffing_rules', 'r'), { minimumRequired: 1 });
    await setDoc(doc(db, 'check_ins', 'own'), { userId: 'staff', checkOutAt: null });
    await setDoc(doc(db, 'check_ins', 'other'), { userId: 'manager', checkOutAt: null });
    await setDoc(doc(db, 'tasks', 'own'), { assignedTo: 'staff', status: 'pending' });
    await setDoc(doc(db, 'tasks', 'legacy'), { assigned_to: 'staff', status: 'pending' });
    await setDoc(doc(db, 'notifications', 'own'), { userId: 'staff', isRead: false, confirmStatus: 'pending' });
    await setDoc(doc(db, 'notifications', 'other'), { userId: 'manager', isRead: false });
  });
});
after(async () => { await env?.cleanup(); });
function db(id, claims = {}) { return env.authenticatedContext(id, { firebase: { sign_in_provider: 'custom' }, ...claims }).firestore(); }
test('public and anonymous clients cannot read or write database', async () => {
  for (const client of [env.unauthenticatedContext().firestore(), db('staff', { firebase: { sign_in_provider: 'anonymous' } })]) {
    await assertFails(getDocs(collection(client, 'users')));
    await assertFails(setDoc(doc(client, 'staffing_rules', 'injected'), { minimumRequired: 0 }));
  }
});
test('only active members can read profiles and nobody can read server credentials', async () => {
  await assertSucceeds(getDocs(collection(db('staff'), 'users')));
  await assertFails(getDoc(doc(db('inactive'), 'users', 'staff')));
  for (const id of ['staff', 'manager', 'admin']) await assertFails(getDoc(doc(db(id), 'user_credentials', 'staff')));
});
test('forged administrator claim and direct profile edits cannot escalate privileges', async () => {
  const client = db('staff', { role: 'super_admin' });
  await assertFails(updateDoc(doc(client, 'users', 'staff'), { role: 'super_admin' }));
  await assertFails(updateDoc(doc(client, 'staffing_rules', 'r'), { minimumRequired: 0 }));
  await assertFails(setDoc(doc(client, 'users', 'rogue'), { isActive: true, role: 'super_admin' }));
  await assertSucceeds(updateDoc(doc(client, 'users', 'staff'), { lang: 'it' }));
});
test('only administrators can edit staffing', async () => {
  await assertSucceeds(updateDoc(doc(db('admin'), 'staffing_rules', 'r'), { minimumRequired: 2 }));
  await assertFails(updateDoc(doc(db('manager'), 'staffing_rules', 'r'), { minimumRequired: 0 }));
});
test('leave and swap changes must go through server validation', async () => {
  for (const id of ['staff','manager','admin']) {
    await assertFails(setDoc(doc(db(id), 'leave_requests', 'rogue'), { userId: 'staff', status: 'approved' }));
    await assertFails(setDoc(doc(db(id), 'swaps', 'rogue'), { status: 'accepted' }));
  }
});
test('staff can only check out their own record and cannot edit arrival time', async () => {
  await assertFails(updateDoc(doc(db('staff'), 'check_ins', 'other'), { checkOutAt: '2026-09-23T17:00:00Z' }));
  await assertFails(updateDoc(doc(db('staff'), 'check_ins', 'own'), { checkInAt: '2026-09-23T08:00:00Z' }));
  await assertSucceeds(updateDoc(doc(db('staff'), 'check_ins', 'own'), { checkOutAt: '2026-09-23T17:00:00Z' }));
});
test('task assignees can complete both schemas without changing assignment', async () => {
  for (const id of ['own', 'legacy']) {
    await assertSucceeds(updateDoc(doc(db('staff'), 'tasks', id), { status: 'done' }));
    await assertFails(updateDoc(doc(db('staff'), 'tasks', id), { assignedTo: 'manager' }));
    await assertFails(deleteDoc(doc(db('staff'), 'tasks', id)));
  }
});
test('notification responses are private and cannot change recipients', async () => {
  await assertSucceeds(updateDoc(doc(db('staff'), 'notifications', 'own'), { confirmStatus: 'confirmed', isRead: true }));
  await assertFails(getDoc(doc(db('staff'), 'notifications', 'other')));
  await assertFails(updateDoc(doc(db('staff'), 'notifications', 'own'), { userId: 'manager' }));
});
test('spectators cannot write team data', async () => {
  await assertFails(setDoc(doc(db('viewer'), 'tasks', 'new'), { assignedTo: 'viewer' }));
  await assertFails(setDoc(doc(db('viewer'), 'notificationSettings', 'global'), { dailyReminderEnabled: false }));
});
