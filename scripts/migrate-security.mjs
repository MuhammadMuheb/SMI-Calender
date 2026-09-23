import fs from 'node:fs';
import { services } from '../server/firebase.cjs';
import { hashPin } from '../server/credentials.cjs';
const { db } = services();
const apply = process.argv.includes('--apply');
const collections = await db.listCollections();
const snapshots = await Promise.all(collections.map(c => c.get()));
const users = snapshots.find(s => s.query.id === 'users');
if (!users) throw new Error('Users collection not found');
const groups = new Map();
for (const d of users.docs) {
  const key = String(d.data().username || d.id).toLowerCase().trim();
  groups.set(key, [...(groups.get(key) || []), d]);
}
const aliases = new Map();
const canonical = [];
const changes = [];
for (const [username, copies] of groups) {
  copies.sort((a, b) => String(b.data().updatedAt || '').localeCompare(String(a.data().updatedAt || '')) || Number(b.id === b.data().id) - Number(a.id === a.data().id));
  const newest = copies[0];
  const id = String(newest.data().id || newest.id);
  const data = Object.assign({}, ...copies.slice().reverse().map(d => d.data()), { id, username });
  const pin = data.pinHash || data.pin;
  const existingSecret = snapshots.find(s => s.query.id === 'user_credentials')?.docs.find(d => d.id === id)?.data();
  if (!pin && !existingSecret?.pinHash) throw new Error('Missing credential for ' + username);
  let secret = existingSecret;
  if (pin) {
    if (String(pin).startsWith('$2')) secret = { pinHash: pin }; // Existing bcrypt hash remains server-only.
    else secret = { pinHash: String(pin).startsWith('scrypt:') ? pin : hashPin(String(pin)) };
  }
  delete data.pin; delete data.pinHash; delete data.pushSubscription;
  for (const d of copies) { aliases.set(d.id, id); aliases.set(d.data().id, id); }
  aliases.set(username, id);
  aliases.set('usr_' + username, id);
  canonical.push({ id, data, secret });
  changes.push({ user: username, canonicalId: id, copies: copies.length, credential: String(secret.pinHash).startsWith('scrypt:') ? 'scrypt' : 'bcrypt' });
}
const referenceKeys = new Set(['userId', 'user_id', 'assignedTo', 'assigned_to', 'proposerId', 'receiverId', 'createdBy', 'assignedBy', 'assigned_by', 'performedBy', 'actorId', 'updatedBy', 'adjustedBy', 'completedBy', 'completed_by', 'staffUserId']);
function rewrite(value, key = '') {
  if (typeof value === 'string') return referenceKeys.has(key) ? aliases.get(value) || value : value;
  if (Array.isArray(value)) return value.map(v => rewrite(v, key));
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, ['userRef', 'decidedBy', 'overriddenBy'].includes(key) && k === 'id' ? aliases.get(v) || v : rewrite(v, k)]));
  }
  return value;
}
const guide = snapshots.find(s => s.query.id === 'jobRoles')?.docs.find(d => d.data().name?.toLowerCase() === 'guide')?.id;
const active = new Set(canonical.filter(u => u.data.isActive).map(u => u.id));
const assignments = snapshots.find(s => s.query.id === 'role_assignments')?.docs || [];
const guideCount = new Set(assignments.map(d => rewrite(d.data())).filter(a => a.jobRoleId === guide && active.has(a.userId)).map(a => a.userId)).size;
const writes = new Map();
for (const s of snapshots) {
  if (['users', 'user_credentials'].includes(s.query.id)) continue;
  for (const d of s.docs) {
    const old = d.data();
    const data = rewrite(old);
    if (s.query.id === 'leave_requests') {
      data.userId = data.userId || data.user_id;
      const type = data.leaveType || data.leave_type || data.type;
      data.leaveType = ({ day_off: 'regular_day_off', vacation: 'paid_vacation', sick: 'sick_day' })[type] || type || 'regular_day_off';
      const who = canonical.find(u => u.id === data.userId);
      if (who) data.userRef = { id: who.id, displayName: who.data.displayName, role: who.data.role };
    }
    if (s.query.id === 'staffing_rules' && data.jobRoleId === guide && guideCount === 1 && data.minimumRequired === 2) data.minimumRequired = 1;
    if (s.query.id === 'audit_log' && /rejected Unknown.* for\s*$/.test(data.description || '')) {
      const leave = snapshots.find(x => x.query.id === 'leave_requests')?.docs.find(x => x.id === data.entityId)?.data();
      if (leave) {
        const who = canonical.find(u => u.id === (aliases.get(leave.userId) || leave.userId));
        data.description = (data.actorName || 'Administrator') + ' rejected ' + (who?.data.displayName || leave.userId) + "'s " + (leave.leaveType || leave.type || 'leave request') + ' for ' + (leave.date || 'an unspecified date');
      } else data.description = (data.actorName || 'Administrator') + ' rejected a leave request (original request no longer available)';
    }
    if (JSON.stringify(data) !== JSON.stringify(old)) writes.set(d.ref.path, data);
  }
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', users: changes, referencedDocumentsToUpdate: writes.size, guideCount }, null, 2));
if (apply) {
  fs.mkdirSync('.private-backups', { recursive: true });
  const backup = '.private-backups/security-' + Date.now() + '.json';
  fs.writeFileSync(backup, JSON.stringify(snapshots.flatMap(s => s.docs.map(d => ({ path: d.ref.path, data: d.data() }))), null, 2), { flag: 'wx' });
  if (users.size + canonical.length * 2 + writes.size > 450) throw new Error('Migration exceeds safe atomic size; no changes applied. Backup saved.');
  const previous = new Map(snapshots.flatMap(s => s.docs.map(d => [d.ref.path, d])));
  const paths = new Set([...users.docs.map(d => d.ref.path), ...writes.keys(), ...canonical.flatMap(u => ['users/' + u.id, 'user_credentials/' + u.id])]);
  await db.runTransaction(async tx => {
    const current = await tx.getAll(...[...paths].map(path => db.doc(path)));
    for (const doc of current) {
      const before = previous.get(doc.ref.path);
      if (doc.exists !== !!before || (before && !doc.updateTime.isEqual(before.updateTime))) throw new Error('Data changed during migration; no changes applied. Run the dry-run again.');
    }
    for (const d of users.docs) if (!canonical.some(u => u.id === d.id)) tx.delete(d.ref);
    for (const u of canonical) {
      tx.set(db.collection('users').doc(u.id), u.data);
      tx.set(db.collection('user_credentials').doc(u.id), u.secret);
    }
    for (const [path, data] of writes) tx.set(db.doc(path), data);
  });
  console.log('Migration committed atomically. Backup: ' + backup);
}
