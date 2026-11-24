import { services } from '../server/firebase.cjs';
import { DEFAULT_POLICY } from '../shared/work-arrangements.mjs';
const { db } = services();
const apply = process.argv.includes('--apply');
const ref = db.collection('work_policies').doc('global');
const migration = db.collection('schema_migrations').doc('20261124_work_arrangements');
const result = await db.runTransaction(async tx => {
  const [existing, marker] = await Promise.all([tx.get(ref), tx.get(migration)]);
  if (marker.exists) return { changed: false, message: 'Work arrangements migration already applied' };
  if (!apply) return { changed: false, wouldCreatePolicy: !existing.exists, message: 'Dry run; use --apply' };
  const now = new Date().toISOString();
  // Additive only: no user, leave, attendance or historic WFH record is rewritten.
  if (!existing.exists) tx.create(ref, { ...DEFAULT_POLICY, updatedAt: now, updatedBy: 'migration' });
  tx.create(migration, { version: 1, appliedAt: now, createdPolicy: !existing.exists });
  tx.create(db.collection('audit_log').doc(), { actorId: 'system', actorName: 'Migration', action: 'work_arrangements_migrated', entityType: 'work_policy', entityId: 'global', description: 'Enabled approved work arrangements; retained existing leave and attendance', createdAt: now });
  return { changed: true, createdPolicy: !existing.exists };
});
console.log(JSON.stringify(result));
await db.terminate();
