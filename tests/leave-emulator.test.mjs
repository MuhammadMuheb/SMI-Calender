import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Exercise actual Firestore transaction retries, not the serial mock used by
// server.test.cjs. Authentication/authorization is covered by that suite.
assert(process.env.FIRESTORE_EMULATOR_HOST, 'Production writes are forbidden');
const app = initializeApp({ projectId: 'demo-smi-calendar' }, 'leave-tests');
const db = getFirestore(app);
const require = createRequire(import.meta.url);
require.cache[require.resolve('../server/firebase.cjs')] = { exports: {
  services: () => ({ db }),
  requireUser: async req => ({ id: req.userId, displayName: req.userId, role: req.userId === 'root' ? 'super_admin' : 'staff' }),
} };
const leave = require('../api/leave.js');
async function call(userId, body) {
  const result = { status: 200 };
  await leave({ method: 'POST', userId, body }, {
    status(code) { result.status = code; return this; },
    json(value) { result.body = value; return this; },
  });
  return result;
}
before(async () => {
  for (const collection of await db.listCollections()) {
    for (const doc of (await collection.get()).docs) await doc.ref.delete();
  }
  for (const id of ['a', 'b']) {
    await db.collection('users').doc(id).set({ displayName: id, role: 'staff', isActive: true });
    await db.collection('role_assignments').doc(id).set({ userId: id, jobRoleId: 'guide' });
  }
  await db.collection('leave_settings').doc('global').set({ autoApprove: true });
  await db.collection('staffing_rules').doc('guide').set({ jobRoleId: 'guide', minimumRequired: 1, enforcement: 'warning_only', dayOfWeek: null });
});
after(async () => { await db.terminate(); await deleteApp(app); });

test('Firestore retries simultaneous automatic approvals and leaves the second request pending', async () => {
  const results = await Promise.all(['a', 'b'].map(userId => call(userId, {
    action: 'create', data: { userId, date: '2026-10-07', leaveType: 'regular_day_off' },
  })));
  assert.deepEqual(results.map(r => r.status), [200, 200], JSON.stringify(results));
  assert.deepEqual(results.map(r => r.body.request.status).sort(), ['approved', 'pending']);
  const approvals = await db.collection('notifications').where('type', '==', 'leave_approved').get();
  assert.equal(approvals.size, 1, 'Transaction retries must not duplicate notifications');
});

test('Firestore serializes simultaneous Approve All decisions and rejects the stale green request', async () => {
  for (const userId of ['a', 'b']) await db.collection('leave_requests').doc('bulk-' + userId).set({
    userId, date: '2026-10-08', leaveType: 'regular_day_off', status: 'pending',
  });
  const results = await Promise.all(['a', 'b'].map(userId => call('root', {
    action: 'update', id: 'bulk-' + userId, data: { status: 'approved', greenOnly: true },
  })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409], JSON.stringify(results));
  const requests = await db.collection('leave_requests').where('date', '==', '2026-10-08').get();
  assert.deepEqual(requests.docs.map(d => d.data().status).sort(), ['approved', 'pending']);
});
