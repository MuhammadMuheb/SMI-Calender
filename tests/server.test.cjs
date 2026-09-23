const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { hashPin, verifyPin } = require('../server/credentials.cjs');
const { staffingError } = require('../server/leave.cjs');
const { atLocal, shiftFor, runAttendance } = require('../server/attendance.cjs');
let rows, sequence, queue;
function snapshot(ref) { return { ref, id: ref.id, exists: rows.has(ref.path), data: () => structuredClone(rows.get(ref.path)) }; }
function collection(name, filters = [], maximum = Infinity) {
  return {
    doc(id = 'generated_' + ++sequence) {
      const ref = { id, path: name + '/' + id, get: async () => snapshot(ref),
        set: async data => rows.set(ref.path, structuredClone(data)), delete: async () => rows.delete(ref.path) };
      return ref;
    },
    where(key, op, value) { return collection(name, [...filters, [key, op, value]], maximum); },
    limit(n) { return collection(name, filters, n); },
    async get() {
      const docs = [...rows.entries()].filter(([path, data]) => path.split('/')[0] === name && filters.every(([key, op, value]) => op === '==' ? data[key] === value : op === 'in' && value.includes(data[key])))
        .slice(0, maximum).map(([path]) => snapshot(this.doc(path.split('/')[1])));
      return { docs, size: docs.length, empty: !docs.length };
    },
    async add(data) { const ref = this.doc(); await ref.set(data); return ref; },
  };
}
const db = { collection, async runTransaction(fn) {
  const execute = async () => {
    const pending = [];
    const read = async ref => { assert.equal(pending.length, 0, 'Transactions must read before writing'); return ref.get(); };
    const result = await fn({ get: read, getAll: (...refs) => Promise.all(refs.map(read)),
      create: (ref, value) => { assert(!rows.has(ref.path)); pending.push(() => rows.set(ref.path, structuredClone(value))); },
      set: (ref, value) => pending.push(() => rows.set(ref.path, structuredClone(value))),
      update: (ref, value) => pending.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...structuredClone(value) })),
      delete: ref => pending.push(() => rows.delete(ref.path)) });
    pending.forEach(write => write()); return result;
  };
  const next = queue.then(execute); queue = next.catch(() => {}); return next;
} };
const tokens = {
  staff: { uid: 'a', firebase: { sign_in_provider: 'custom' }, role: 'super_admin' },
  receiver: { uid: 'b', firebase: { sign_in_provider: 'custom' } },
  manager: { uid: 'm', firebase: { sign_in_provider: 'custom' } },
  admin: { uid: 'root', firebase: { sign_in_provider: 'custom' } },
  anonymous: { uid: 'a', firebase: { sign_in_provider: 'anonymous' } },
};
require.cache[require.resolve('firebase-admin')] = { exports: { apps: [{}], firestore: () => db, auth: () => ({
  verifyIdToken: async token => { if (!tokens[token]) throw new Error('Invalid'); return tokens[token]; },
  createCustomToken: async uid => 'signed-token-' + uid, revokeRefreshTokens: async () => {}, deleteUser: async () => {},
}) } };
const { requireUser } = require('../server/firebase.cjs');
const leave = require('../api/leave.js');
const swaps = require('../api/swaps.js');
const session = require('../api/session.js');
const users = require('../api/users.js');
const attendance = require('../api/attendance.js');
async function call(handler, token, body, method = 'POST') {
  const result = { statusCode: 200 };
  const res = { setHeader() {}, status(code) { result.statusCode = code; return this; }, json(value) { result.body = value; return this; } };
  await handler({ method, body, headers: token ? { authorization: 'Bearer ' + token } : {}, socket: { remoteAddress: 'test' } }, res);
  return result;
}
beforeEach(() => {
  rows = new Map(); sequence = 0; queue = Promise.resolve();
  for (const [id, role] of [['a','staff'],['b','staff'],['m','manager'],['root','super_admin']]) rows.set('users/' + id, { id, username: id, displayName: id, role, isActive: true });
  rows.set('role_assignments/a', { userId: 'a', jobRoleId: 'guide', isPrimary: true });
  rows.set('role_assignments/b', { userId: 'b', jobRoleId: 'guide', isPrimary: true });
  rows.set('jobRoles/guide', { shiftStart: '09:00', shiftEnd: '18:00' });
});
test('PINs are salted, verified, and plaintext is refused', () => {
  const one = hashPin('4321'), two = hashPin('4321');
  assert.notEqual(one, two); assert(verifyPin('4321', one)); assert(!verifyPin('1234', one)); assert(!verifyPin('4321', '4321'));
});
test('missing, anonymous and forged role sessions cannot administer users', async () => {
  assert.equal((await call(users, null, { action: 'delete', id: 'b' })).statusCode, 401);
  assert.equal((await call(users, 'anonymous', { action: 'delete', id: 'b' })).statusCode, 401);
  assert.equal((await call(users, 'staff', { action: 'delete', id: 'b' })).statusCode, 403);
  const actor = await requireUser({ headers: { authorization: 'Bearer staff' } });
  assert.equal(actor.role, 'staff'); // Ignores stale or forged admin claim.
});
test('deactivated users immediately lose access', async () => {
  rows.get('users/a').isActive = false;
  await assert.rejects(requireUser({ headers: { authorization: 'Bearer staff' } }), { status: 403 });
});
test('sick leave bypasses coverage, planned leave uses configured limits', async () => {
  rows.set('staffing_rules/guide', { jobRoleId: 'guide', minimumRequired: 2, enforcement: 'hard_block', dayOfWeek: null });
  const data = { userId: 'a', date: '2026-10-01', leaveType: 'regular_day_off', status: 'approved' };
  assert.equal((await call(leave, 'staff', { action: 'create', data })).statusCode, 409);
  const sick = await call(leave, 'staff', { action: 'create', data: { ...data, leaveType: 'sick_day' } });
  assert.equal(sick.statusCode, 200);
  assert.equal(rows.get('leave_requests/' + sick.body.id).status, 'pending');
});
test('no role does not automatically block planned leave', () => {
  assert.equal(staffingError('2026-10-01', 'a', 'regular_day_off', [], [], [], new Set(['a'])), null);
});
test('staff cannot approve, edit another request, or impersonate another requester', async () => {
  rows.set('leave_requests/r', { userId: 'b', date: '2026-10-01', leaveType: 'sick_day', status: 'pending' });
  assert.equal((await call(leave, 'staff', { action: 'update', id: 'r', data: { status: 'approved' } })).statusCode, 403);
  assert.equal((await call(leave, 'staff', { action: 'create', data: { userId: 'b', date: '2026-11-01', leaveType: 'sick_day' } })).statusCode, 403);
});
test('managers cannot approve their own leave or override existing decisions', async () => {
  rows.set('leave_requests/r', { userId: 'm', status: 'pending' });
  assert.equal((await call(leave, 'manager', { action: 'update', id: 'r', data: { status: 'approved' } })).statusCode, 403);
  rows.set('leave_requests/r', { userId: 'a', status: 'rejected' });
  assert.equal((await call(leave, 'manager', { action: 'update', id: 'r', data: { status: 'approved', isOverridden: true } })).statusCode, 403);
});
test('swap acceptance transfers once and rejects the wrong receiver', async () => {
  rows.set('leave_requests/original', { userId: 'a', date: '2026-10-01', leaveType: 'regular_day_off', status: 'approved' });
  assert.equal((await call(swaps, 'staff', { action: 'propose', originalRequestId: 'original', receiverId: 'b' })).statusCode, 200);
  assert.equal((await call(swaps, 'manager', { action: 'accept', id: 'original' })).statusCode, 409);
  const results = await Promise.all([call(swaps, 'receiver', { action: 'accept', id: 'original' }), call(swaps, 'receiver', { action: 'accept', id: 'original' })]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  assert.equal(rows.get('leave_requests/original').status, 'cancelled');
  assert.equal([...rows.values()].filter(r => r.userId === 'b' && r.status === 'approved').length, 1);
});
test('login reads only server credentials and rate limits bad attempts', async () => {
  rows.set('user_credentials/a', { pinHash: hashPin('4321') });
  assert.equal((await call(session, null, { username: 'a', pin: '4321' })).statusCode, 200);
  for (let i = 0; i < 7; i++) assert.equal((await call(session, null, { username: 'a', pin: '0000' })).statusCode, 401);
  assert.equal((await call(session, null, { username: 'a', pin: '4321' })).statusCode, 429);
});
test('Rome shift times respect summer/winter time and overnight shifts', () => {
  assert.equal(atLocal('2026-07-01', '09:00').toISOString(), '2026-07-01T07:00:00.000Z');
  assert.equal(atLocal('2026-01-01', '09:00').toISOString(), '2026-01-01T08:00:00.000Z');
  const shift = shiftFor({ userId: 'a', checkInAt: '2026-07-01T22:30:00Z' }, [{ userId: 'a', jobRoleId: 'night' }], [{ id: 'night', shiftStart: '22:00', shiftEnd: '06:00' }]);
  assert.equal(shift.end.toISOString(), '2026-07-02T04:00:00.000Z');
});
test('attendance correction rejects non-admins and backwards times', async () => {
  const body = { action: 'save', data: { userId: 'a', checkInAt: '2026-09-23T09:00Z', checkOutAt: '2026-09-23T08:00Z', isWfh: true }, reason: 'Correction' };
  assert.equal((await call(attendance, 'manager', body)).statusCode, 403);
  assert.equal((await call(attendance, 'admin', body)).statusCode, 400);
});
test('attendance reminders deduplicate and automatic checkout persists', async () => {
  rows.set('check_ins/c', { userId: 'a', userName: 'a', checkInAt: '2026-09-23T08:00:00Z', checkOutAt: null });
  await runAttendance(db, new Date('2026-09-23T16:30:00Z'));
  const count = [...rows.keys()].filter(k => k.startsWith('notifications/')).length;
  assert(count > 0);
  await runAttendance(db, new Date('2026-09-23T16:45:00Z'));
  assert.equal([...rows.keys()].filter(k => k.startsWith('notifications/')).length, count);
  await runAttendance(db, new Date('2026-09-23T18:30:00Z'));
  assert.equal(rows.get('check_ins/c').checkOutAt, '2026-09-23T16:00:00.000Z');
  assert.equal(rows.get('check_ins/c').autoCheckedOut, true);
});
