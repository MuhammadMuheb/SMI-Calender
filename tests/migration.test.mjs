import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyPin } from '../server/credentials.cjs';
const projectId = 'demo-smi-calendar';
test('migration merges identities, preserves references and credentials, repairs Guide rule, and reruns safely', async () => {
  assert(process.env.FIRESTORE_EMULATOR_HOST, 'This test requires the emulator; production writes are forbidden');
  const app = initializeApp({ projectId });
  const db = getFirestore(app);
  for (const collection of await db.listCollections()) {
    for (const doc of (await collection.get()).docs) await doc.ref.delete();
  }
  for (const name of ['nabeel', 'zack']) {
    const data = { id: 'usr_' + name, username: name, displayName: name, role: name === 'nabeel' ? 'super_admin' : 'staff', isActive: true, pinHash: '4321' };
    await db.collection('users').doc(name).set(data);
    await db.collection('users').doc('usr_' + name).set(data);
  }
  await db.collection('jobRoles').doc('guide').set({ name: 'Guide' });
  await db.collection('role_assignments').doc('a').set({ userId: 'zack', jobRoleId: 'guide' });
  await db.collection('staffing_rules').doc('guide').set({ jobRoleId: 'guide', minimumRequired: 2 });
  await db.collection('tasks').doc('legacy').set({ assigned_to: 'zack' });
  await db.collection('leave_requests').doc('r').set({ userId: 'zack', userRef: { id: 'zack' }, leaveType: 'sick_day', date: '2026-09-01' });
  await db.collection('audit_log').doc('broken').set({ actorName: 'Nabeel', entityId: 'r', description: "Nabeel rejected Unknown's for" });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smi-migration-test-'));
  const script = path.resolve('scripts/migrate-security.mjs');
  async function run(...args) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...args], { cwd: directory, windowsHide: true,
        env: { ...process.env, FIREBASE_PROJECT_ID: projectId } });
      let output = '';
      child.stdout.on('data', b => { output += b; });
      child.stderr.on('data', b => { output += b; });
      child.on('error', reject);
      child.on('close', code => { if (code) reject(new Error(output)); else resolve(output); });
    });
  }
  try {
    await run();
    assert.equal((await db.collection('users').get()).size, 4, 'dry-run must not mutate');
    await run('--apply');
    assert.equal((await db.collection('users').get()).size, 2);
    assert.equal((await db.collection('users').doc('usr_zack').get()).data().pinHash, undefined);
    assert(verifyPin('4321', (await db.collection('user_credentials').doc('usr_zack').get()).data().pinHash));
    assert.equal((await db.collection('tasks').doc('legacy').get()).data().assigned_to, 'usr_zack');
    assert.equal((await db.collection('leave_requests').doc('r').get()).data().userRef.id, 'usr_zack');
    assert.equal((await db.collection('staffing_rules').doc('guide').get()).data().minimumRequired, 1);
    assert.match((await db.collection('audit_log').doc('broken').get()).data().description, /zack.*sick_day.*2026-09-01/);
    await run('--apply');
    assert.equal((await db.collection('users').get()).size, 2);
    assert(verifyPin('4321', (await db.collection('user_credentials').doc('usr_zack').get()).data().pinHash));
    assert(fs.readdirSync(path.join(directory, '.private-backups')).length >= 2);
  } finally {
    await db.terminate();
    const resolved = fs.realpathSync(directory);
    const tempRoot = fs.realpathSync(os.tmpdir()) + path.sep;
    if (resolved.startsWith(tempRoot) && path.basename(resolved).startsWith('smi-migration-test-')) fs.rmSync(resolved, { recursive: true });
  }
});
