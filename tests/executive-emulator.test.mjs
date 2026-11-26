import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrateExecutive } from '../scripts/migrate-executive.mjs';
assert(process.env.FIRESTORE_EMULATOR_HOST, 'Production writes are forbidden');
const app = initializeApp({ projectId: 'demo-smi-calendar' }, 'executive-tests');
const db = getFirestore(app);
const require = createRequire(import.meta.url);
require.cache[require.resolve('../server/firebase.cjs')] = { exports: {
  services: () => ({ db }),
  requireUser: async req => ({ id: req.userId, displayName: req.userId, role: req.userId === 'root' ? 'super_admin' : 'staff' }),
} };
const leave = require('../api/leave.js');
const { read } = require('../server/work-arrangements.cjs');
let credentials = [];
before(async () => {
  for (const col of await db.listCollections()) for (const doc of (await col.get()).docs) await doc.ref.delete();
});
after(async () => { await db.terminate(); await deleteApp(app); });

test('Executive migration is dry-run safe, atomic and idempotent with private salted credentials', async () => {
  assert.equal((await migrateExecutive(db)).dryRun, true);
  assert.equal((await db.collection('users').get()).size, 0);
  const result = await migrateExecutive(db, { apply: true, saveCredentials: value => { credentials = value; } });
  assert.equal(result.changed, true);
  assert.equal(credentials.length, 2);
  assert.equal((await db.collection('users').get()).size, 2);
  assert.equal((await db.collection('role_assignments').get()).size, 2);
  const rules = (await db.collection('staffing_rules').get()).docs.map(d => d.data());
  assert.deepEqual(rules.map(r => r.dayOfWeek).sort(), [0, 1, 2, 3, 4]);
  assert(rules.every(r => r.minimumRequired === 1 && r.enforcement === 'hard_block'));
  const { verifyPin } = require('../server/credentials.cjs');
  for (const person of credentials) {
    const user = (await db.collection('users').doc('usr_' + person.username).get()).data();
    assert.equal(user.role, 'staff');
    assert.equal(user.pin, undefined);
    const privateData = (await db.collection('user_credentials').doc(user.id).get()).data();
    assert(verifyPin(person.pin, privateData.pinHash));
    const work = await read(db, user, { action: 'list' });
    assert.deepEqual(work.policy.workingDays, [1, 2, 3, 4, 5]);
    assert(work.policy.allowedModes.includes('hybrid'));
  }
  assert.equal((await migrateExecutive(db, { apply: true, saveCredentials: () => assert.fail('Must not reset PINs') })).changed, false);
});

test('simultaneous Executive vacation approvals retain one available Executive', async () => {
  await db.collection('leave_settings').doc('global').set({ autoApprove: true });
  const results = await Promise.all(['usr_maria', 'usr_emmanuelle'].map(async userId => {
    const result = { status: 200 };
    await leave({ method: 'POST', userId, body: { action: 'create', data: { userId, date: '2026-11-27', leaveType: 'paid_vacation' } } }, {
      status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; },
    });
    return result;
  }));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409], JSON.stringify(results));
  assert.equal((await db.collection('leave_requests').where('status', '==', 'approved').get()).size, 1);
});
