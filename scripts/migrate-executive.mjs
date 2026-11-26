import { randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { hashPin } from '../server/credentials.cjs';

export async function migrateExecutive(db, { apply = false, saveCredentials = () => {}, now = new Date().toISOString() } = {}) {
  const people = ['Maria', 'Emmanuelle'].map(displayName => ({ displayName, username: displayName.toLowerCase(), pin: String(randomInt(100000, 1000000)) }));
  const markerRef = db.collection('schema_migrations').doc('20261126_executive');
  return db.runTransaction(async tx => {
    const [marker, users, roles, assignments] = await Promise.all([
      tx.get(markerRef), tx.get(db.collection('users')), tx.get(db.collection('jobRoles')), tx.get(db.collection('role_assignments')),
    ]);
    if (marker.exists) return { changed: false, message: 'Executive migration already applied' };
    const matchingRoles = roles.docs.filter(d => String(d.data().name).trim().toLowerCase() === 'executive');
    if (matchingRoles.length > 1) throw new Error('Multiple Executive categories exist; reconcile before migration');
    const roleId = matchingRoles[0]?.id || 'role_executive';
    if (!matchingRoles.length && roles.docs.some(d => d.id === roleId)) throw new Error('Executive role ID is already used');
    const targets = people.map(person => {
      const matches = users.docs.filter(d => [d.data().username, d.data().displayName].some(v => String(v).trim().toLowerCase() === person.username));
      if (matches.length > 1) throw new Error('Multiple matching people: ' + person.displayName);
      const existing = matches[0];
      const id = existing?.id || 'usr_' + person.username;
      if (!existing && users.docs.some(d => d.id === id)) throw new Error('User ID already used: ' + id);
      return { ...person, id, existing };
    });
    const plan = { roleId, people: targets.map(p => ({ id: p.id, name: p.displayName, create: !p.existing })), workingDays: 'Monday–Friday', minimumAvailable: 1 };
    if (!apply) return { changed: false, dryRun: true, ...plan };
    // Store new login details privately before committing so a network failure cannot lose them.
    saveCredentials(targets.filter(p => !p.existing).map(({ username, displayName, pin }) => ({ username, displayName, pin })));
    const roleRef = db.collection('jobRoles').doc(roleId);
    tx.set(roleRef, { ...(matchingRoles[0]?.data() || {}), id: roleId, name: 'Executive', leavePolicy: 'executive', color: '#7C3AED', isHidden: false,
      shiftStart: '09:00', shiftEnd: '18:00', createdAt: matchingRoles[0]?.data().createdAt || now, updatedAt: now });
    for (const person of targets) {
      const ref = db.collection('users').doc(person.id);
      if (!person.existing) {
        tx.create(ref, { id: person.id, username: person.username, displayName: person.displayName, role: 'staff', isActive: true, jobRole: ['Executive'], createdAt: now, updatedAt: now });
        tx.create(db.collection('user_credentials').doc(person.id), { pinHash: hashPin(person.pin) });
      } else {
        tx.update(ref, { jobRole: [...new Set([...(person.existing.data().jobRole || []), 'Executive'])], isActive: true, updatedAt: now });
      }
      const mine = assignments.docs.filter(d => d.data().userId === person.id);
      const assigned = mine.find(d => d.data().jobRoleId === roleId);
      for (const other of mine) if (other.data().isPrimary && other.id !== assigned?.id) tx.update(other.ref, { isPrimary: false });
      const assignmentRef = assigned?.ref || db.collection('role_assignments').doc('assign_executive_' + person.id);
      tx.set(assignmentRef, { id: assignmentRef.id, userId: person.id, jobRoleId: roleId, isPrimary: true, assignedAt: assigned?.data().assignedAt || now });
    }
    // Staffing rules use Monday=0; work schedules use JavaScript Sunday=0.
    for (let dayOfWeek = 0; dayOfWeek < 5; dayOfWeek++) {
      const ref = db.collection('staffing_rules').doc('executive_weekday_' + dayOfWeek);
      tx.set(ref, { id: ref.id, jobRoleId: roleId, dayOfWeek, minimumRequired: 1, enforcement: 'hard_block', createdAt: now, updatedAt: now });
    }
    tx.create(markerRef, { appliedAt: now, ...plan });
    tx.create(db.collection('audit_log').doc(), { actorId: 'system', actorName: 'Migration', action: 'executive_category_created', entityType: 'job_role', entityId: roleId,
      description: 'Added Executive category and Maria/Emmanuelle: weekday cover 1, weekends off, WFH/Hybrid eligible, staff vacation accrual.', createdAt: now });
    return { changed: true, ...plan };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { services } = await import('../server/firebase.cjs');
  const { db } = services();
  try {
    const result = await migrateExecutive(db, { apply: process.argv.includes('--apply'), saveCredentials: credentials => {
      if (!credentials.length) return;
      mkdirSync('.private-backups', { recursive: true });
      writeFileSync('.private-backups/executive-login.local.json', JSON.stringify(credentials, null, 2), { mode: 0o600 });
    } });
    console.log(JSON.stringify(result));
  } finally { await db.terminate(); }
}
