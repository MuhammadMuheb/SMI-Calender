// Run with node --env-file=.env scripts/fix-office-location.mjs [--apply].
// Source: https://maps.app.goo.gl/Z7VCpYbpKJWSYd9c6 (Show Me Italy).
import { services } from '../server/firebase.cjs';

const ref = services().db.collection('locations').doc('1ba6e500-4495-4841-aa57-368bd0188a41');
const apply = process.argv.includes('--apply');
const correction = { latitude: 41.8966075, longitude: 12.4901289, radius_meters: 100, radiusMeters: 100 };

await services().db.runTransaction(async tx => {
  const snapshot = await tx.get(ref);
  if (!snapshot.exists || snapshot.data().name !== 'Office - Via dei Serpenti') {
    throw new Error('Expected office location not found; no changes made');
  }
  const current = snapshot.data();
  const before = Object.fromEntries(Object.keys(correction).map(key => [key, current[key]]));
  const changed = Object.entries(correction).some(([key, value]) => current[key] !== value);
  console.log(JSON.stringify({ path: ref.path, before, after: correction, apply, changed }, null, 2));
  if (apply && changed) tx.update(ref, { ...correction, updatedAt: new Date().toISOString() });
});
